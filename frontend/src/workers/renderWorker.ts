// src/workers/renderWorker.ts
// Dedicated Web Worker — runs in its own thread.
// Owns the OffscreenCanvas transferred from WorkerBridge.
// Handles: INIT, RENDER_FRAME, GENERATE_WAVEFORM

// Note: this file is bundled by Vite as a worker module.

let offscreenCanvas: OffscreenCanvas | null = null;
let gl: WebGL2RenderingContext | null = null;

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT': {
            offscreenCanvas = payload.canvas as OffscreenCanvas;
            gl = offscreenCanvas.getContext('webgl2', { alpha: false }) as WebGL2RenderingContext | null;
            if (!gl) {
                self.postMessage({ type: 'ERROR', payload: 'WebGL2 not available in worker' });
                return;
            }
            gl.clearColor(0, 0, 0, 1);
            self.postMessage({ type: 'READY' });
            break;
        }

        case 'RENDER_FRAME': {
            // payload: { cues: string[], style: object }
            // Full render is handled by Compositor on main thread when using WorkerBridge
            // This worker acts as a lightweight passthrough for future offscreen rendering
            self.postMessage({ type: 'FRAME_DONE' });
            break;
        }

        case 'GENERATE_WAVEFORM': {
            // payload: { buffer: ArrayBuffer, width: number }
            const { buffer, width } = payload as { buffer: ArrayBuffer; width: number };
            const peaks = generateWaveformPeaks(buffer, width);
            // Transfer peaks buffer back (zero-copy)
            self.postMessage({ type: 'WAVEFORM_DONE', payload: { peaks } }, { transfer: [peaks.buffer] });
            break;
        }

        default:
            console.warn('[renderWorker] Unknown message type:', type);
    }
};

// ─── Waveform peak extraction ─────────────────────────────────────────────────

function generateWaveformPeaks(buffer: ArrayBuffer, width: number): Float32Array {
    const samples = new Float32Array(buffer);
    const peaks = new Float32Array(width);
    const blockSize = Math.floor(samples.length / width);

    for (let i = 0; i < width; i++) {
        let max = 0;
        const offset = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
            const abs = Math.abs(samples[offset + j] ?? 0);
            if (abs > max) max = abs;
        }
        peaks[i] = max;
    }
    return peaks;
}
