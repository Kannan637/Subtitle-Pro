// src/engine/CaptionRenderer.ts
// Draws subtitle cue text on an OffscreenCanvas 2D context,
// transfers the result as ImageBitmap for zero-copy WebGL upload.

export interface CaptionStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    color: string;
    strokeColor: string;
    strokeWidth: number;
    verticalPosition: 'bottom' | 'top' | 'center'; // normalised, 0-1 from top
    backgroundAlpha: number; // 0 = transparent, 1 = solid
    backgroundColor: string;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
    fontFamily: '"Komika Axis", "Bangers", "Anton", Impact, sans-serif',
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 3,
    verticalPosition: 'bottom',
    backgroundAlpha: 0,
    backgroundColor: '#000000',
};

export class CaptionRenderer {
    private offscreen: OffscreenCanvas;
    private ctx: OffscreenCanvasRenderingContext2D;

    constructor(width: number, height: number) {
        this.offscreen = new OffscreenCanvas(width, height);
        const ctx = this.offscreen.getContext('2d');
        if (!ctx) throw new Error('CaptionRenderer: could not get 2D context from OffscreenCanvas');
        this.ctx = ctx;
    }

    resize(width: number, height: number): void {
        this.offscreen = new OffscreenCanvas(width, height);
        const ctx = this.offscreen.getContext('2d');
        if (!ctx) throw new Error('CaptionRenderer: could not get 2D context after resize');
        this.ctx = ctx;
    }

    /** Render a single cue line and return an ImageBitmap (transferable, zero-copy). */
    renderCue(text: string, style: CaptionStyle = DEFAULT_CAPTION_STYLE): ImageBitmap {
        const ctx = this.ctx;
        const w = this.offscreen.width;
        const h = this.offscreen.height;

        ctx.clearRect(0, 0, w, h);

        ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const y = this._getY(h, style);
        const measuredWidth = ctx.measureText(text).width;

        // Background pill
        if (style.backgroundAlpha > 0) {
            const pad = 12;
            ctx.globalAlpha = style.backgroundAlpha;
            ctx.fillStyle = style.backgroundColor;
            const rx = w / 2 - measuredWidth / 2 - pad;
            ctx.fillRect(rx, y - style.fontSize * 0.7, measuredWidth + pad * 2, style.fontSize * 1.4);
            ctx.globalAlpha = 1;
        }

        // Stroke (outline)
        if (style.strokeWidth > 0) {
            ctx.strokeStyle = style.strokeColor;
            ctx.lineWidth = style.strokeWidth;
            ctx.lineJoin = 'round';
            ctx.strokeText(text, w / 2, y);
        }

        // Fill
        ctx.fillStyle = style.color;
        ctx.fillText(text, w / 2, y);

        return this.offscreen.transferToImageBitmap();
    }

    private _getY(height: number, style: CaptionStyle): number {
        switch (style.verticalPosition) {
            case 'top':
                return height * 0.1;
            case 'center':
                return height * 0.5;
            case 'bottom':
            default:
                return height * 0.88;
        }
    }
}
