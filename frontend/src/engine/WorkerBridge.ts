// src/engine/WorkerBridge.ts
// Main-thread interface to renderWorker.
// Transfers OffscreenCanvas ownership to the worker (zero-copy).
// All heavy computation (WebGL renders, waveform extraction) happens off-thread.

export interface WaveformResult {
    peaks: Float32Array;
}

type MessageCallback = (type: string, payload: unknown) => void;

export class WorkerBridge {
    private worker: Worker;
    private ready = false;
    private onReadyCallbacks: Array<() => void> = [];
    private onMessage: MessageCallback | null = null;

    constructor(canvas: HTMLCanvasElement, onMessage?: MessageCallback) {
        this.onMessage = onMessage ?? null;

        this.worker = new Worker(
            new URL('../workers/renderWorker.ts', import.meta.url),
            { type: 'module' },
        );

        this.worker.onmessage = (e: MessageEvent) => {
            const { type, payload } = e.data;

            if (type === 'READY') {
                this.ready = true;
                this.onReadyCallbacks.forEach((cb) => cb());
                this.onReadyCallbacks = [];
            }

            this.onMessage?.(type, payload);
        };

        this.worker.onerror = (err) => {
            console.error('[WorkerBridge] Worker error:', err.message);
        };

        // Transfer canvas control to worker — main thread can no longer draw on it
        const offscreen = canvas.transferControlToOffscreen();
        this.worker.postMessage(
            { type: 'INIT', payload: { canvas: offscreen } },
            [offscreen], // Transferable — zero-copy
        );
    }

    /** Wait for the worker to signal READY before sending render commands. */
    onReady(cb: () => void): void {
        if (this.ready) {
            cb();
        } else {
            this.onReadyCallbacks.push(cb);
        }
    }

    /**
     * Send a frame to be rendered off-thread.
     * @param cues   Active cue texts for the current frame.
     * @param style  Caption style config.
     */
    renderFrame(cues: string[], style: Record<string, unknown>): void {
        if (!this.ready) return;
        this.worker.postMessage({ type: 'RENDER_FRAME', payload: { cues, style } });
    }

    /**
     * Request waveform peaks for an AudioBuffer's channel data.
     * The ArrayBuffer is transferred (zero-copy) to the worker.
     */
    generateWaveform(channelData: Float32Array, width: number): void {
        if (!this.ready) return;
        const buffer = channelData.buffer.slice(0) as ArrayBuffer;
        this.worker.postMessage(
            { type: 'GENERATE_WAVEFORM', payload: { buffer, width } },
            [buffer],
        );
    }

    dispose(): void {
        this.worker.terminate();
    }
}
