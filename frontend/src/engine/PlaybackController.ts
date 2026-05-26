// src/engine/PlaybackController.ts
// Uses requestVideoFrameCallback (RVFC) for frame-perfect sync between the
// HTMLVideoElement decoder and the Compositor render loop.
//
// Unlike requestAnimationFrame, RVFC fires exactly when a decoded video frame
// is ready — giving pixel-accurate subtitle timing with zero drift.

import type { Compositor } from './Compositor';
import type { CaptionStyle } from './CaptionRenderer';
import type { SubtitleCue } from '@/lib/api';

type VideoFrameMetadata = {
    mediaTime: number;
};

type VideoWithFrameCallback = HTMLVideoElement & {
    requestVideoFrameCallback?: (
        callback: (now: DOMHighResTimeStamp, metadata: VideoFrameMetadata) => void,
    ) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
};

export class PlaybackController {
    private video: VideoWithFrameCallback;
    private compositor: Compositor;
    private getActiveCues: (ms: number) => SubtitleCue[];
    private setTime: (ms: number) => void;
    private captionStyle: CaptionStyle | undefined;

    // requestVideoFrameCallback handle (for cancellation)
    private rvfcHandle = 0;
    private isRunning = false;

    constructor(
        video: HTMLVideoElement,
        compositor: Compositor,
        getActiveCues: (ms: number) => SubtitleCue[],
        setTime: (ms: number) => void,
        captionStyle?: CaptionStyle,
    ) {
        this.video = video as VideoWithFrameCallback;
        this.compositor = compositor;
        this.getActiveCues = getActiveCues;
        this.setTime = setTime;
        this.captionStyle = captionStyle;
    }

    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this._scheduleFrame();
    }

    stop(): void {
        this.isRunning = false;
        if (this.rvfcHandle && this.video.cancelVideoFrameCallback) {
            this.video.cancelVideoFrameCallback(this.rvfcHandle);
        }
        this.rvfcHandle = 0;
    }

    updateStyle(style: CaptionStyle): void {
        this.captionStyle = style;
    }

    // ── Private ─────────────────────────────────────────────────────────────────

    private _scheduleFrame(): void {
        if (!this.isRunning) return;

        if (typeof this.video.requestVideoFrameCallback === 'function') {
            // Modern path — fires exactly when video frame is ready
            this.rvfcHandle = this.video.requestVideoFrameCallback(
                this._onFrame.bind(this),
            );
        } else {
            // Fallback — requestAnimationFrame (less accurate for sync)
            this.rvfcHandle = requestAnimationFrame(() => {
                this._onFrameFallback();
            });
        }
    }

    private _onFrame(
        _now: DOMHighResTimeStamp,
        meta: { mediaTime: number },
    ): void {
        const ms = meta.mediaTime * 1000;
        this.setTime(ms);

        const cues = this.getActiveCues(ms);
        this.compositor.render(cues, this.captionStyle);

        // Schedule next frame only if still playing
        if (this.isRunning && !this.video.paused && !this.video.ended) {
            this._scheduleFrame();
        } else {
            this.isRunning = !this.video.paused && !this.video.ended;
        }
    }

    private _onFrameFallback(): void {
        const ms = this.video.currentTime * 1000;
        this.setTime(ms);

        const cues = this.getActiveCues(ms);
        this.compositor.render(cues, this.captionStyle);

        if (this.isRunning && !this.video.paused && !this.video.ended) {
            this._scheduleFrame();
        }
    }
}
