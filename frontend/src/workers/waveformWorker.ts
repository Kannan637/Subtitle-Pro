// src/workers/waveformWorker.ts
// Dedicated worker for audio waveform peak extraction.
// Accepts AudioBuffer channel data as a Float32Array, returns compressed peaks.

self.onmessage = (e: MessageEvent) => {
    const { channelData, width } = e.data as {
        channelData: ArrayBuffer;
        width: number;
    };

    const samples = new Float32Array(channelData);
    const peaks = extractPeaks(samples, width);

    // Transfer peaks back (zero-copy)
    self.postMessage({ peaks }, { transfer: [peaks.buffer] });
};

function extractPeaks(samples: Float32Array, width: number): Float32Array {
    const peaks = new Float32Array(width * 2); // [min, max] per column
    const blockSize = Math.ceil(samples.length / width);

    for (let i = 0; i < width; i++) {
        let min = 0;
        let max = 0;
        const start = i * blockSize;
        const end = Math.min(start + blockSize, samples.length);

        for (let j = start; j < end; j++) {
            const s = samples[j];
            if (s < min) min = s;
            if (s > max) max = s;
        }

        peaks[i * 2] = min;
        peaks[i * 2 + 1] = max;
    }

    return peaks;
}
