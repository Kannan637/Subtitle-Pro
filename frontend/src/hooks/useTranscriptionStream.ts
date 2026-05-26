// src/hooks/useTranscriptionStream.ts
// Resilient SSE hook for transcription progress.

import { useEffect, useState } from 'react';
import {
    API_BASE,
    AUTH_SESSION_RECOVERY_MESSAGE,
    getApiErrorMessage,
    getCurrentAuthToken,
    transcriptionApi,
    type TranscriptionJobResponse,
} from '@/lib/api';

export type TranscriptionStatus = 'idle' | 'queued' | 'processing' | 'complete' | 'error' | 'not_found';

export interface TranscriptionStreamState {
    status: TranscriptionStatus;
    progress: number; // 0-100
    jobId: string | null;
    errorMessage: string | null;
    errorCode: string | null;
}

type StreamPayload = {
    status?: string;
    progress?: number;
    job_id?: string;
    error_message?: string | null;
    error_code?: string | null;
};

function normalizeStatus(status: string | undefined): TranscriptionStatus {
    if (
        status === 'queued'
        || status === 'processing'
        || status === 'complete'
        || status === 'error'
        || status === 'not_found'
    ) {
        return status;
    }
    if (status === 'none') return 'not_found';
    return 'processing';
}

function responseToPayload(data: TranscriptionJobResponse): StreamPayload {
    return {
        status: data.status,
        progress: data.progress_pct ?? 0,
        job_id: data.job_id,
        error_message: data.error_message,
        error_code: data.error_code,
    };
}

function payloadToState(payload: StreamPayload, previous?: TranscriptionStreamState): TranscriptionStreamState {
    const status = normalizeStatus(payload.status);
    return {
        status,
        progress: Math.max(0, Math.min(100, payload.progress ?? previous?.progress ?? 0)),
        jobId: payload.job_id ?? previous?.jobId ?? null,
        errorMessage: payload.error_message ?? (status === 'error' ? previous?.errorMessage ?? null : null),
        errorCode: payload.error_code ?? (status === 'error' ? previous?.errorCode ?? null : null),
    };
}

export function useTranscriptionStream(projectId: string | null): TranscriptionStreamState {
    const [state, setState] = useState<TranscriptionStreamState>({
        status: 'idle',
        progress: 0,
        jobId: null,
        errorMessage: null,
        errorCode: null,
    });

    useEffect(() => {
        if (!projectId) {
            setState({
                status: 'idle',
                progress: 0,
                jobId: null,
                errorMessage: null,
                errorCode: null,
            });
            return;
        }

        let es: EventSource | null = null;
        let cancelled = false;
        let terminalReached = false;
        let reconnectTimer: number | null = null;
        let pollTimer: number | null = null;
        let reconnectAttempts = 0;

        const closeStream = () => {
            es?.close();
            es = null;
        };

        const clearTimers = () => {
            if (reconnectTimer !== null) {
                window.clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            if (pollTimer !== null) {
                window.clearTimeout(pollTimer);
                pollTimer = null;
            }
        };

        const applyPayload = (payload: StreamPayload) => {
            setState((prev) => {
                const next = payloadToState(payload, prev);
                if (next.status === 'complete' || next.status === 'error') {
                    terminalReached = true;
                    clearTimers();
                    closeStream();
                }
                return next;
            });
        };

        const pollStatus = async (): Promise<boolean> => {
            if (cancelled || terminalReached) return true;
            try {
                const res = await transcriptionApi.get(projectId);
                applyPayload(responseToPayload(res.data));
                return res.data.status === 'complete' || res.data.status === 'error';
            } catch (err: unknown) {
                if (cancelled || terminalReached) return true;
                setState((prev) => ({
                    ...prev,
                    errorMessage: prev.errorMessage || getApiErrorMessage(err, 'Transcription status is temporarily unavailable. Retrying...'),
                    errorCode: prev.errorCode || 'status_poll_failed',
                }));
                return false;
            }
        };

        const scheduleReconnect = () => {
            if (cancelled || terminalReached || reconnectTimer !== null) return;

            const delayMs = Math.min(1_000 * (2 ** Math.min(reconnectAttempts, 4)), 15_000);
            reconnectAttempts += 1;
            reconnectTimer = window.setTimeout(() => {
                reconnectTimer = null;
                void connect();
            }, delayMs);
        };

        const schedulePoll = () => {
            if (cancelled || terminalReached || pollTimer !== null) return;
            pollTimer = window.setTimeout(async () => {
                pollTimer = null;
                const terminal = await pollStatus();
                if (!terminal) schedulePoll();
            }, 3_000);
        };

        const handleStreamDrop = () => {
            if (cancelled || terminalReached) return;
            closeStream();
            void pollStatus().then((terminal) => {
                if (terminal || cancelled || terminalReached) return;
                schedulePoll();
                scheduleReconnect();
            });
        };

        async function connect() {
            if (cancelled || terminalReached) return;

            let token: string | null = null;
            try {
                token = await getCurrentAuthToken({ forceRefresh: reconnectAttempts > 0 });
            } catch {
                token = null;
            }

            if (cancelled || terminalReached) return;

            if (!token) {
                setState((prev) => ({
                    ...prev,
                    status: 'error',
                    errorMessage: AUTH_SESSION_RECOVERY_MESSAGE,
                    errorCode: 'auth_token_unavailable',
                }));
                terminalReached = true;
                return;
            }

            clearTimers();
            closeStream();

            const url = `${API_BASE}/v1/transcription/${projectId}/stream?token=${encodeURIComponent(token)}`;
            es = new EventSource(url);

            es.onopen = () => {
                reconnectAttempts = 0;
                setState((prev) => (
                    prev.errorCode === 'stream_connection_lost' || prev.errorCode === 'status_poll_failed'
                        ? { ...prev, errorMessage: null, errorCode: null }
                        : prev
                ));
            };

            es.onmessage = (event) => {
                try {
                    applyPayload(JSON.parse(event.data) as StreamPayload);
                } catch {
                    // Ignore malformed SSE payload.
                }
            };

            es.onerror = handleStreamDrop;
        }

        void connect();

        return () => {
            cancelled = true;
            terminalReached = true;
            clearTimers();
            closeStream();
        };
    }, [projectId]);

    return state;
}
