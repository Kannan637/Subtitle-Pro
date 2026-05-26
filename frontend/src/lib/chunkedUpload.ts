// src/lib/chunkedUpload.ts
// Splits a File into 5 MB chunks and POSTs them to /v1/media/chunk,
// then calls /v1/media/assemble to produce the final server-side file.
//
// Benefit over single-shot upload:
//   - Survives connection interruptions (retry per chunk)
//   - Progress is granular (per-chunk callbacks)
//   - No single HTTP request > 5 MB

import { api } from './api';


const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

export interface ChunkedUploadOptions {
    file: File;
    projectId: string;
    onProgress?: (percent: number) => void;
    onChunkComplete?: (chunkIndex: number, total: number) => void;
}

export async function chunkedUpload({
    file,
    projectId,
    onProgress,
    onChunkComplete,
}: ChunkedUploadOptions): Promise<{ file_path: string; size_bytes: number }> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedBytes = 0;

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        const form = new FormData();
        form.append('project_id', projectId);
        form.append('chunk_index', String(i));
        form.append('total_chunks', String(totalChunks));
        form.append('chunk', chunkBlob, file.name);

        // Retry once on failure
        await _postWithRetry('/v1/media/chunk', form);

        uploadedBytes += chunkBlob.size;
        onProgress?.(Math.round((uploadedBytes / file.size) * 100));
        onChunkComplete?.(i, totalChunks);
    }

    // Assemble on the server
    const { data } = await api.post<{ file_path: string; size_bytes: number }>(
        '/v1/media/assemble',
        {
            project_id: projectId,
            total_chunks: totalChunks,
            original_filename: file.name,
        },
        { timeout: 120_000 },
    );

    return data;
}

async function _postWithRetry(url: string, form: FormData, retries = 1): Promise<void> {
    try {
        await api.post(url, form, { timeout: 30_000 });
    } catch (err) {
        if (retries > 0) {
            await new Promise((r) => setTimeout(r, 1000)); // 1s backoff
            return _postWithRetry(url, form, retries - 1);
        }
        throw err;
    }
}
