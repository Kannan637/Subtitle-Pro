// src/engine/Compositor.ts
// WebGL2 rendering engine — owns the entire display pipeline.
//
// Pipeline per frame:
//   video.requestVideoFrameCallback → grab ImageBitmap → upload to texture
//   → draw full-screen quad → overlay caption texture → present
//
// Why WebGL over CSS?
//   CSS captions repaint on the main thread → 15-30fps jank.
//   WebGL runs on the GPU compositor thread → stable 60fps.

import { CaptionRenderer } from './CaptionRenderer';
import type { CaptionStyle } from './CaptionRenderer';
import { DEFAULT_CAPTION_STYLE } from './CaptionRenderer';
import type { SubtitleCue } from '@/lib/api';

export class Compositor {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private video: HTMLVideoElement;

    // GL objects
    private videoTexture: WebGLTexture | null = null;
    private captionTexture: WebGLTexture | null = null;
    private program: WebGLProgram | null = null;
    private blendProgram: WebGLProgram | null = null;
    private quadBuffer: WebGLBuffer | null = null;

    private captionRenderer: CaptionRenderer;

    constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
        this.canvas = canvas;
        this.video = video;

        const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
        if (!gl) throw new Error('Compositor: WebGL2 is not available in this browser.');
        this.gl = gl;

        this.captionRenderer = new CaptionRenderer(canvas.width, canvas.height);

        this._initQuadBuffer();
        this._initVideoProgram();
        this._initTextures();

        gl.clearColor(0, 0, 0, 1);
    }

    resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
        this.captionRenderer.resize(width, height);
    }

    /**
     * Render one frame.
     * @param cues    Active subtitle cues at currentTimeMs.
     * @param style   Caption style to apply.
     */
    render(cues: SubtitleCue[], style: CaptionStyle = DEFAULT_CAPTION_STYLE): void {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT);

        this._uploadVideoFrame();
        this._drawQuad(this.videoTexture!);

        // For each active cue, render text to bitmap and overlay
        if (cues.length > 0) {
            const text = cues.map((c) => c.text).join('\n');
            const bitmap = this.captionRenderer.renderCue(text, style);
            this._uploadBitmap(bitmap, this.captionTexture!);
            this._drawQuadBlended(this.captionTexture!);
        }
    }

    dispose(): void {
        const gl = this.gl;
        if (this.videoTexture) gl.deleteTexture(this.videoTexture);
        if (this.captionTexture) gl.deleteTexture(this.captionTexture);
        if (this.program) gl.deleteProgram(this.program);
        if (this.blendProgram) gl.deleteProgram(this.blendProgram);
        if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    private _initQuadBuffer(): void {
        const gl = this.gl;
        // Full-screen quad: positions XY + UVs
        const vertices = new Float32Array([
            -1, -1, 0, 1,
            1, -1, 1, 1,
            -1, 1, 0, 0,
            1, 1, 1, 0,
        ]);
        this.quadBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    private _initVideoProgram(): void {
        const vertSrc = `#version 300 es
      in vec2 a_pos;
      in vec2 a_uv;
      out vec2 v_uv;
      void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
        v_uv = a_uv;
      }
    `;
        const fragSrc = `#version 300 es
      precision mediump float;
      uniform sampler2D u_tex;
      in vec2 v_uv;
      out vec4 fragColor;
      void main() {
        fragColor = texture(u_tex, v_uv);
      }
    `;
        this.program = this._buildProgram(vertSrc, fragSrc);

        // Blended caption program (alpha compositing)
        const blendFrag = `#version 300 es
      precision mediump float;
      uniform sampler2D u_tex;
      in vec2 v_uv;
      out vec4 fragColor;
      void main() {
        vec4 c = texture(u_tex, v_uv);
        if (c.a < 0.01) discard;
        fragColor = c;
      }
    `;
        this.blendProgram = this._buildProgram(vertSrc, blendFrag);
    }

    private _initTextures(): void {
        const gl = this.gl;
        this.videoTexture = gl.createTexture()!;
        this.captionTexture = gl.createTexture()!;

        for (const tex of [this.videoTexture, this.captionTexture]) {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
    }

    private _uploadVideoFrame(): void {
        if (this.video.readyState < 2) return;
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
    }

    private _uploadBitmap(bitmap: ImageBitmap, tex: WebGLTexture): void {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
        bitmap.close();
    }

    private _drawQuad(tex: WebGLTexture): void {
        const gl = this.gl;
        gl.useProgram(this.program);
        this._bindQuad(this.program!);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(this.program!, 'u_tex'), 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    private _drawQuadBlended(tex: WebGLTexture): void {
        const gl = this.gl;
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
        this._drawQuadWith(this.blendProgram!, tex);
        gl.disable(gl.BLEND);
    }

    private _drawQuadWith(prog: WebGLProgram, tex: WebGLTexture): void {
        const gl = this.gl;
        gl.useProgram(prog);
        this._bindQuad(prog);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    private _bindQuad(prog: WebGLProgram): void {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        const posLoc = gl.getAttribLocation(prog, 'a_pos');
        const uvLoc = gl.getAttribLocation(prog, 'a_uv');
        gl.enableVertexAttribArray(posLoc);
        gl.enableVertexAttribArray(uvLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
        gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
    }

    private _buildProgram(vertSrc: string, fragSrc: string): WebGLProgram {
        const gl = this.gl;
        const vs = this._compileShader(gl.VERTEX_SHADER, vertSrc);
        const fs = this._compileShader(gl.FRAGMENT_SHADER, fragSrc);
        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error(`Compositor: shader link error: ${gl.getProgramInfoLog(prog)}`);
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return prog;
    }

    private _compileShader(type: number, src: string): WebGLShader {
        const gl = this.gl;
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(`Compositor: shader compile error: ${gl.getShaderInfoLog(shader)}`);
        }
        return shader;
    }
}
