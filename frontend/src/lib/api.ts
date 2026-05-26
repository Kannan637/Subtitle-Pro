import axios from 'axios';
import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, authPersistenceReady } from './firebase';

type ApiRequestMeta = {
    _retried?: boolean;
    _hadAuthToken?: boolean;
    _skipAuthInvalidation?: boolean;
    _requiresAuth?: boolean;
    _allowAnonymous?: boolean;
};

export type ApiRequestConfig = AxiosRequestConfig & ApiRequestMeta;

function normalizeApiBase(url: string | undefined): string {
    const raw = (url || '').trim();
    if (!raw) return '/api';

    const withoutTrailing = raw.replace(/\/+$/, '');
    try {
        const parsed = new URL(withoutTrailing);
        const pathname = parsed.pathname.replace(/\/+$/, '');
        if (!pathname || pathname === '/') {
            parsed.pathname = '/api';
        } else if (pathname.endsWith('/v1')) {
            parsed.pathname = pathname.slice(0, -3) || '/api';
        }
        return parsed.toString().replace(/\/+$/, '');
    } catch {
        // Relative API base, handled below.
    }

    const withoutLegacyV1 = withoutTrailing.endsWith('/v1')
        ? withoutTrailing.slice(0, -3)
        : withoutTrailing;

    return withoutLegacyV1 || '/api';
}

const API_BASE_URL = normalizeApiBase(import.meta.env.VITE_API_URL || '/api');
export const API_BASE = API_BASE_URL;
export const AUTH_INVALID_EVENT = 'subtitleai:auth-invalid';
export const AUTH_ERROR_STORAGE_KEY = 'subtitleai:auth-error';

export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 120_000, // 2 min for transcription/translation
});

export const AUTH_SESSION_RECOVERY_MESSAGE =
    'Your secure session needs a refresh. Please retry the action; if it continues, sign in again.';

export const AUTH_SESSION_RETRY_MESSAGE =
    'Your secure session is active. Please retry the action.';

export const AUTH_SESSION_REAUTH_MESSAGE =
    'Your secure session could not be verified. Please sign in again.';

const LEGACY_AUTH_SESSION_MESSAGE =
    'Your saved sign-in session is stale.' + ' Please sign in again to refresh secure access.';
const LEGACY_AUTH_SESSION_RETRY_MESSAGE =
    'Your secure session was refreshed. Please retry the action.';

function hasLegacyAuthSessionMessage(value: string | null | undefined): boolean {
    return Boolean(value && (
        value === LEGACY_AUTH_SESSION_MESSAGE ||
        value === LEGACY_AUTH_SESSION_RETRY_MESSAGE ||
        value.toLowerCase().includes('saved sign-in session is stale')
    ));
}

function cleanupLegacyAuthSessionStorage(): void {
    if (typeof window === 'undefined') return;
    for (const storage of [window.sessionStorage, window.localStorage]) {
        const existing = storage.getItem(AUTH_ERROR_STORAGE_KEY);
        if (hasLegacyAuthSessionMessage(existing)) {
            storage.removeItem(AUTH_ERROR_STORAGE_KEY);
        }
    }
}

cleanupLegacyAuthSessionStorage();

let authReadyPromise: Promise<User | null> | null = null;

class AuthTokenUnavailableError extends Error {
    constructor() {
        super('Authentication is still loading. Please wait a moment and retry.');
        this.name = 'AuthTokenUnavailableError';
    }
}

function isAuthTokenUnavailableError(error: unknown): boolean {
    return error instanceof AuthTokenUnavailableError
        || (error instanceof Error && error.name === 'AuthTokenUnavailableError');
}

function waitForAuthUser(timeoutMs = 10_000): Promise<User | null> {
    if (auth.currentUser) {
        return Promise.resolve(auth.currentUser);
    }

    if (!authReadyPromise) {
        authReadyPromise = new Promise((resolve) => {
            let unsubscribe: (() => void) | null = null;
            const timer = window.setTimeout(() => {
                unsubscribe?.();
                authReadyPromise = null;
                resolve(auth.currentUser);
            }, timeoutMs);

            unsubscribe = onAuthStateChanged(auth, (user) => {
                window.clearTimeout(timer);
                unsubscribe?.();
                authReadyPromise = null;
                resolve(user);
            });
        });
    }

    return authReadyPromise;
}

function isVersionedApiRequest(url: string | undefined): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url, API_BASE_URL.startsWith('http') ? API_BASE_URL : window.location.origin);
        return parsed.pathname.includes('/v1/');
    } catch {
        return url.includes('/v1/');
    }
}

function getApiResponseDetail(error: unknown): string {
    if (!axios.isAxiosError(error)) return '';
    const data = error.response?.data;
    const detail =
        (typeof data === 'string' && data.trim()) ||
        data?.detail ||
        data?.message ||
        data?.error ||
        '';
    return typeof detail === 'string' ? detail.trim() : '';
}

function isInvalidSessionDetail(detail: string): boolean {
    const normalized = detail.toLowerCase();
    return (
        normalized.includes('invalid authentication token') ||
        normalized.includes('authentication token could not be verified') ||
        normalized.includes('backend authorization could not be verified') ||
        normalized.includes('server clock is out of sync') ||
        normalized.includes('saved sign-in session is stale') ||
        normalized.includes('sign-in session is invalid') ||
        normalized.includes('token has expired') ||
        normalized.includes('token has been revoked') ||
        normalized.includes('missing authentication token') ||
        normalized.includes('authentication is still loading') ||
        normalized.includes('not authenticated')
    );
}

function normalizeAuthSessionMessage(detail: string, retryExhausted = false): string {
    if (hasLegacyAuthSessionMessage(detail)) {
        cleanupLegacyAuthSessionStorage();
        return auth.currentUser ? AUTH_SESSION_RETRY_MESSAGE : AUTH_SESSION_REAUTH_MESSAGE;
    }
    const normalized = detail.toLowerCase();
    if (retryExhausted) {
        return AUTH_SESSION_REAUTH_MESSAGE;
    }
    if (
        normalized.includes('saved sign-in session is stale') ||
        normalized.includes('backend authorization could not be verified') ||
        normalized.includes('server clock is out of sync')
    ) {
        return auth.currentUser ? AUTH_SESSION_RETRY_MESSAGE : AUTH_SESSION_RECOVERY_MESSAGE;
    }
    if (normalized.includes('invalid authentication token')) {
        return auth.currentUser ? AUTH_SESSION_RETRY_MESSAGE : AUTH_SESSION_RECOVERY_MESSAGE;
    }
    if (normalized.includes('authentication token could not be verified')) {
        return auth.currentUser ? AUTH_SESSION_RETRY_MESSAGE : AUTH_SESSION_RECOVERY_MESSAGE;
    }
    if (normalized.includes('missing authentication token') || normalized.includes('not authenticated')) {
        return 'Authentication is still loading. Please wait a moment and retry.';
    }
    if (normalized.includes('token has expired') || normalized.includes('token has been revoked')) {
        return auth.currentUser ? AUTH_SESSION_RETRY_MESSAGE : AUTH_SESSION_RECOVERY_MESSAGE;
    }
    return auth.currentUser
        ? AUTH_SESSION_RETRY_MESSAGE
        : AUTH_SESSION_REAUTH_MESSAGE;
}

function sanitizeServiceMessage(message: string, fallback: string): string {
    const trimmed = message.trim();
    if (hasLegacyAuthSessionMessage(trimmed)) {
        cleanupLegacyAuthSessionStorage();
        return auth.currentUser ? AUTH_SESSION_RETRY_MESSAGE : AUTH_SESSION_RECOVERY_MESSAGE;
    }
    const normalized = trimmed.toLowerCase();
    const exposesImplementation =
        normalized.includes('lemon squeezy') ||
        normalized.includes('lemonsqueezy') ||
        normalized.includes('firebase') ||
        normalized.includes('fastapi') ||
        normalized.includes('mongodb') ||
        normalized.includes('mongo') ||
        normalized.includes('cloudinary') ||
        normalized.includes('ffmpeg') ||
        normalized.includes('ffprobe') ||
        normalized.includes('yt-dlp') ||
        normalized.includes('groq') ||
        normalized.includes('vite') ||
        normalized.includes('react') ||
        normalized.includes('backend') ||
        normalized.includes('frontend') ||
        normalized.includes('webhook') ||
        normalized.includes('provider') ||
        normalized.includes('api key') ||
        normalized.includes('oauth') ||
        normalized.includes('client id') ||
        normalized.includes('client_id') ||
        normalized.includes('client secret') ||
        normalized.includes('client_secret') ||
        normalized.includes('vite_api_url');

    if (!exposesImplementation) return trimmed;

    if (normalized.includes('checkout') || normalized.includes('payment') || normalized.includes('billing')) {
        return 'Payment checkout is not available right now. Please retry or contact support.';
    }

    if (normalized.includes('auth') || normalized.includes('token') || normalized.includes('session') || normalized.includes('sign-in')) {
        return auth.currentUser ? AUTH_SESSION_RETRY_MESSAGE : AUTH_SESSION_RECOVERY_MESSAGE;
    }

    if (
        normalized.includes('transcription') ||
        normalized.includes('caption') ||
        normalized.includes('render') ||
        normalized.includes('export') ||
        normalized.includes('upload') ||
        normalized.includes('media')
    ) {
        return 'This action is temporarily unavailable. Please retry in a moment.';
    }

    return fallback || 'Something went wrong. Please retry in a moment.';
}

export function isAuthSessionError(error: unknown): boolean {
    if (isAuthTokenUnavailableError(error)) return true;
    const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
    return axios.isAxiosError(error)
        && (statusCode === 401 || statusCode === 403)
        && isInvalidSessionDetail(getApiResponseDetail(error));
}

function invalidateAuthSession(message: string): void {
    if (typeof window !== 'undefined') {
        if (hasLegacyAuthSessionMessage(message)) {
            cleanupLegacyAuthSessionStorage();
            message = auth.currentUser ? AUTH_SESSION_RETRY_MESSAGE : AUTH_SESSION_REAUTH_MESSAGE;
        }
        if (auth.currentUser) {
            window.sessionStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
        } else {
            window.sessionStorage.setItem(AUTH_ERROR_STORAGE_KEY, message);
        }
        window.dispatchEvent(new CustomEvent(AUTH_INVALID_EVENT, { detail: { message } }));
    }
}

function rewriteAuthErrorPayload(error: unknown, message: string): void {
    if (!axios.isAxiosError(error) || !error.response) return;
    if (typeof error.response.data === 'object' && error.response.data !== null) {
        error.response.data.detail = message;
        error.response.data.message = message;
        return;
    }
    error.response.data = { detail: message, message };
}

export async function getCurrentAuthToken(options?: {
    forceRefresh?: boolean;
    timeoutMs?: number;
}): Promise<string | null> {
    await authPersistenceReady;
    const currentUser = auth.currentUser ?? await waitForAuthUser(options?.timeoutMs);
    if (!currentUser) return null;
    return currentUser.getIdToken(options?.forceRefresh ?? false);
}

async function getFreshAuthTokenForRetry(): Promise<string | null> {
    await authPersistenceReady;
    const currentUser = auth.currentUser ?? await waitForAuthUser(3_000);
    if (!currentUser) return null;
    try {
        await currentUser.reload();
    } catch {
        // Reload is best-effort; getIdToken(true) still refreshes the cached ID token.
    }
    return currentUser.getIdToken(true);
}

// Inject Firebase auth token on every request
api.interceptors.request.use(async (config) => {
    const meta = config as typeof config & ApiRequestMeta;
    const token = await getCurrentAuthToken();
    meta._hadAuthToken = Boolean(token);
    const requiresAuth = !meta._allowAnonymous && (meta._requiresAuth ?? isVersionedApiRequest(config.url));
    if (!token && requiresAuth) {
        throw new AuthTokenUnavailableError();
    }
    if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 — force token refresh and retry once
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config as (typeof error.config & ApiRequestMeta) | undefined;
        // Guard against infinite retry loop — only retry once.
        // Use waitForAuthUser (not auth.currentUser) to handle the Firebase
        // session-restore window on hard refresh where currentUser is briefly null.
        if (error.response?.status === 401 && config && !config._retried) {
            const existingUser = auth.currentUser ?? await waitForAuthUser(3_000);
            if (existingUser) {
                config._retried = true;
                try {
                    const token = await getFreshAuthTokenForRetry();
                    config.headers = config.headers ?? {};
                    if (token) {
                        config.headers.Authorization = `Bearer ${token}`;
                        return api.request(config);
                    }
                } catch {
                    // Token refresh failed — fall through to reject
                }
            }
        }
        if (isAuthSessionError(error)) {
            const message = getApiErrorMessage(error, AUTH_SESSION_RECOVERY_MESSAGE);
            rewriteAuthErrorPayload(error, message);

            const requestHadAuthToken = Boolean(config?._hadAuthToken);
            const skipAuthInvalidation = Boolean(config?._skipAuthInvalidation);
            if (!skipAuthInvalidation && (requestHadAuthToken || auth.currentUser)) {
                invalidateAuthSession(message);
            }
        }
        return Promise.reject(error);
    }
);

export function getApiErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data;
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const retryExhausted = Boolean((error.config as ApiRequestMeta | undefined)?._retried);

        const detail =
            (typeof data === 'string' && data.trim()) ||
            data?.detail ||
            data?.message ||
            data?.error;

        if (typeof detail === 'string' && detail.trim()) {
            if ((status === 401 || status === 403) && isInvalidSessionDetail(detail)) {
                return normalizeAuthSessionMessage(detail, retryExhausted);
            }
            return sanitizeServiceMessage(detail, fallback);
        }

        if (error.code === 'ERR_NETWORK') {
            return 'Subtitlepro services are temporarily unreachable. Please check your connection and retry.';
        }

        if (status === 502 || status === 503 || status === 504) {
            return `Subtitlepro services are temporarily unavailable (${status}${statusText ? ` ${statusText}` : ''}). Please retry in a moment.`;
        }

        if (status) {
            return `Request failed (${status}${statusText ? ` ${statusText}` : ''}).`;
        }
    }

    if (isAuthTokenUnavailableError(error)) {
        return auth.currentUser ? AUTH_SESSION_RETRY_MESSAGE : AUTH_SESSION_REAUTH_MESSAGE;
    }

    if (error instanceof Error && error.message) {
        return sanitizeServiceMessage(error.message, fallback);
    }

    return fallback;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Project {
    id: string;
    name: string;
    status: string;
    type?: string;
    created_at: string;
    duration_sec?: number;
    media_url?: string;
}

export interface CaptionControlStyle {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    italic?: boolean;
    underline?: boolean;
    uppercase?: boolean;
    textCase?: 'original' | 'upper' | 'lower' | 'title';
    color?: string;
    strokeColor?: string;
    strokeWidth?: number;
    shadowColor?: string;
    glowColor?: string;
    background?: string;
    borderRadius?: number;
    highlightWord?: boolean;
    highlightColor?: string;
    highlightTextColor?: string;
    align?: 'left' | 'center' | 'right';
    position?: 'top' | 'center' | 'bottom';
    offsetX?: number;
    offsetY?: number;
    maxWidthPct?: number;
    textOpacity?: number;
    enterAnim?: string;
    exitAnim?: string;
    animDuration?: number;
    animDelay?: number;
    lineHeight?: number;
    letterSpacing?: number;
    captionMode?: 'word' | 'chunk' | 'sentence';
}

export interface ControlPanelSettings {
    project_id: string;
    selected_template: string | null;
    custom_style: CaptionControlStyle;
    resolved_style?: CaptionControlStyle;
    updated_at: string;
}

export interface SubtitleCue {
    _id: string;
    id?: string;
    track_id: string;
    sequence: number;
    start_ms: number;
    end_ms: number;
    text: string;
    speaker_id?: string;
    confidence?: number;
}

export interface SubtitleTrack {
    track_id: string;
    language_code: string;
    is_original: boolean;
    created_by: string;
    version: number;
    cues: SubtitleCue[];
}

export interface TranscriptionJobResponse {
    status: 'none' | 'queued' | 'processing' | 'complete' | 'error' | 'unknown';
    progress_pct?: number;
    job_id?: string;
    model_used?: string;
    detected_lang?: string;
    error_message?: string | null;
    error_code?: string | null;
    completed_at?: string;
    track_id?: string | null;
    cue_count?: number;
    cues?: SubtitleCue[];
    message?: string;
}

export interface UsageStats {
    credits_remaining: number;
    credits_used: number;
    plan: string;
    project_count: number;
    minutes_transcribed: number;
    languages_used: number;
    history: Array<{
        _id: string;
        type: string;
        amount_sec: number;
        amount_credits?: number;
        reference: string;
        note: string;
        created_at: string;
    }>;
}

export interface BillingCheckoutResponse {
    provider: 'lemonsqueezy';
    plan: 'creator' | 'studio';
    checkout_url: string;
}

// ─── API Clients ─────────────────────────────────────────────────────────────

export const billingApi = {
    createCheckout: (plan: 'creator' | 'studio') =>
        api.post<BillingCheckoutResponse>('/v1/billing/checkout', { plan }),
};

export const projectsApi = {
    /** List projects with optional cursor-based pagination (limit 20 per page). */
    list: (cursor?: string) =>
        api.get<{ items: Project[]; next_cursor: string | null }>('/v1/projects/', {
            params: cursor ? { cursor, limit: 20 } : { limit: 20 },
        }),
    /** Fallback: fetch all projects (no pagination) — used for initial load & search. */
    listAll: async () => {
        const res = await projectsApi.list();
        const payload: unknown = res.data;
        const rows = Array.isArray(payload)
            ? payload
            : typeof payload === 'object' && payload !== null && Array.isArray((payload as { items?: unknown }).items)
                ? (payload as { items: Project[] }).items
                : [];
        return { ...res, data: rows as Project[] };
    },
    create: (name: string, type: string = 'subtitle') => api.post<Project>('/v1/projects/', { name, type }),
    get: (id: string) => api.get<Project>(`/v1/projects/${id}`),
    delete: (id: string) => api.delete(`/v1/projects/${id}`),
};

export const controlPanelApi = {
    get: (projectId: string) =>
        api.get<ControlPanelSettings>(`/v1/control-panel/${projectId}`),
    save: (
        projectId: string,
        payload: {
            selected_template: string | null;
            custom_style: CaptionControlStyle;
            resolved_style?: CaptionControlStyle;
        },
    ) =>
        api.put<ControlPanelSettings>(`/v1/control-panel/${projectId}`, payload),
};

export const mediaApi = {
    upload: (projectId: string, file: File, onUploadProgress?: (e: AxiosProgressEvent) => void) => {
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('file', file);
        return api.post('/v1/media/upload', formData, {
            timeout: 300_000, // 5 min for large uploads
            onUploadProgress,
        });
    },
    uploadChunk: (projectId: string, chunk: Blob, chunkIndex: number, totalChunks: number, fileName: string) => {
        const form = new FormData();
        form.append('project_id', projectId);
        form.append('chunk_index', String(chunkIndex));
        form.append('total_chunks', String(totalChunks));
        form.append('chunk', chunk, fileName);
        return api.post('/v1/media/chunk', form, { timeout: 30_000 });
    },
    assemble: (projectId: string, totalChunks: number, originalFilename: string) =>
        api.post('/v1/media/assemble', { project_id: projectId, total_chunks: totalChunks, original_filename: originalFilename }),
    getStreamUrl: (projectId: string) =>
        `${API_BASE_URL}/v1/media/stream/${projectId}`,
    getProxyUrl: (projectId: string) =>
        api.get<{ proxy_ready: boolean; proxy_path: string | null; original_path: string }>(`/v1/media/proxy/${projectId}`),
    /** Fetch a blob URL with auth for HTML5 <video> src */
    getAuthenticatedStreamUrl: async (
        projectId: string,
        targetRatio?: '16:9' | '9:16',
        reframeMode?: 'person_center' | 'fit_blur' | 'none',
    ): Promise<string> => {
        const params: Record<string, string> = {};
        if (targetRatio) params.target_ratio = targetRatio;
        if (reframeMode) params.reframe_mode = reframeMode;
        const res = await api.get(`/v1/media/stream/${projectId}`, {
            params,
            responseType: 'blob',
            timeout: 300_000,
        });
        return URL.createObjectURL(res.data);
    },
};

export const transcriptionApi = {
    start: (projectId: string, language = 'auto', model = 'whisper-large-v3-turbo') =>
        api.post(`/v1/transcription/${projectId}`, null, {
            params: { language, model },
            timeout: 60_000, // Returns 202 immediately now
        }),
    get: (projectId: string) =>
        api.get<TranscriptionJobResponse>(`/v1/transcription/${projectId}`),
    /** Returns the SSE stream URL (token injected as query param by useTranscriptionStream hook). */
    streamUrl: (projectId: string) =>
        `${API_BASE_URL}/v1/transcription/${projectId}/stream`,
};

export const translationApi = {
    start: (projectId: string, targetLanguages: string[], tone = 'neutral') =>
        api.post(`/v1/translation/${projectId}`, {
            target_languages: targetLanguages,
            tone,
        }, { timeout: 300_000 }),
    get: (projectId: string) =>
        api.get(`/v1/translation/${projectId}`),
};

export const subtitlesApi = {
    get: (projectId: string, lang?: string) =>
        api.get<{ tracks: SubtitleTrack[] }>(`/v1/subtitles/${projectId}`, {
            params: lang ? { lang } : {},
        }),
    updateCue: (cueId: string, data: { text?: string; start_ms?: number; end_ms?: number }) =>
        api.put(`/v1/subtitles/cue/${cueId}`, data),
    updateAllCues: (projectId: string, cues: SubtitleCue[]) =>
        api.put<{ message: string; cues: SubtitleCue[] }>(`/v1/subtitles/track/${projectId}`, { cues }),
    export: (projectId: string, format: string, lang?: string) =>
        api.get(`/v1/subtitles/export/${projectId}`, {
            params: { format, ...(lang ? { lang } : {}) },
            responseType: format === 'json' ? 'json' : 'blob',
        }),
};

export const analyticsApi = {
    getUsage: () => api.get<UsageStats>('/v1/analytics/usage'),
};

export const exportApi = {
    mp4: (
        projectId: string,
        cues: SubtitleCue[],
        style?: CaptionControlStyle | Record<string, unknown>,
        target_aspect_ratio?: string,
        preview_viewport?: { width: number; height: number },
        broll_track?: Array<{
            video_url: string;
            pexels_id?: string;
            start_ms: number;
            end_ms: number;
        }>,
        motion_graphics_track?: Array<{
            clip_id: string;
            cue_id?: string;
            text: string;
            keyword?: string;
            source_text?: string;
            start_ms: number;
            end_ms: number;
            style?: string;
            style_family?: string;
            moment_type?: string;
            motion_role?: string;
            motion_principle?: string;
            important_words?: string[];
            placement?: string;
            accent_color?: string;
            background?: string;
            solid_background?: string;
            image_url?: string;
            image_alt?: string;
            image_pexels_id?: string;
            image_credit?: string;
            image_query?: string;
            animation?: string;
            sound_cue?: string;
            editing_note?: string;
        }>,
        music_track?: {
            preview_url: string;
            start_ms: number;
            end_ms?: number;
            duration?: number;
            volume_db?: number;
            trim_start_ms?: number;
            trim_end_ms?: number;
        },
        sfx_track?: Array<{
            file_url: string;
            start_ms: number;
            end_ms?: number;
            duration?: number;
            volume_db?: number;
            trim_start_ms?: number;
            trim_end_ms?: number;
        }>,
    ) =>
        api.post(`/v1/export/${projectId}/mp4`, { cues, style, target_aspect_ratio, preview_viewport, broll_track, motion_graphics_track, music_track, sfx_track }, {
            responseType: 'blob',
            timeout: 600_000,
        }),
};

// ─── B-roll Types ─────────────────────────────────────────────────────────────

export interface BrollClip {
    video_url: string;
    thumbnail: string;
    width: number;
    height: number;
    duration: number;
    pexels_id: string;
}

export interface BrollSuggestion {
    cue_id: string;
    text: string;
    start_ms: number;
    end_ms: number;
    keyword: string;
    importance: number;
    broll: BrollClip | null;
}

export interface BrollSuggestResponse {
    project_id: string;
    total_cues: number;
    clips_found: number;
    suggestions: BrollSuggestion[];
}

export const brollApi = {
    suggest: (projectId: string, coverage = 0.5, orientation = 'landscape') =>
        api.post<BrollSuggestResponse>(`/v1/broll/${projectId}/suggest`, { coverage, orientation }, {
            timeout: 300_000, // 5 min — LLM + Pexels calls can take time
        }),
    preview: (projectId: string, keyword: string, orientation = 'landscape') =>
        api.get<BrollClip>(`/v1/broll/${projectId}/preview`, { params: { keyword, orientation } }),
};

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export interface MotionGraphicSuggestion {
    clip_id: string;
    cue_id: string;
    text: string;
    keyword: string;
    source_text: string;
    start_ms: number;
    end_ms: number;
    duration_ms: number;
    importance: number;
    style: string;
    style_family: string;
    moment_type: string;
    motion_role: string;
    motion_principle: string;
    important_words: string[];
    shape: string;
    animation: string;
    placement: string;
    accent_color: string;
    background: string;
    solid_background: string;
    image_url?: string;
    image_alt?: string;
    image_pexels_id?: string;
    image_credit?: string;
    image_query?: string;
    sound_cue: string;
    editing_note: string;
    reason: string;
    html: string;
}

export interface MotionGraphicsSuggestResponse {
    project_id: string;
    total_cues: number;
    suggestions: MotionGraphicSuggestion[];
}

export const motionGraphicsApi = {
    suggest: (projectId: string, density = 0.35, maxItems = 12) =>
        api.post<MotionGraphicsSuggestResponse>(
            `/v1/motion-graphics/${projectId}/suggest`,
            { density, max_items: maxItems },
            { timeout: 180_000 },
        ),
};

export interface OrchestrationStatus {
    job_id: string;
    status: string;
    agent_status: Record<string, string>;
    results: {
        analysis?: {
            mood_profile?: MoodProfile;
        };
        broll?: BrollSuggestion[];
        music?: MusicSuggestionsResult;
        sfx?: SFXSuggestionsResult;
        transitions?: TransitionSuggestion[];
        gaps?: Array<{ start_ms: number; end_ms: number; duration_ms: number; type: string }>;
        [key: string]: unknown;
    };
    created_at: string;
    completed_at: string;
}

export interface MoodProfile {
    primary_mood: string;
    secondary_moods: string[];
    confidence: number;
    energy_level: 'low' | 'medium' | 'high';
    pace_level: 'slow' | 'medium' | 'fast';
}

export interface MusicSuggestion {
    id: string;
    name: string;
    preview_url: string | null;
    duration: number;
    timeline_start_ms?: number;
    timeline_end_ms?: number;
    trim_start_ms?: number;
    trim_end_ms?: number;
    tags?: string[];
    score: number;
    matched_tags: string[];
    source: 'cloudinary';
    reason: string;
}

export interface MusicSuggestionsResult {
    suggestions: MusicSuggestion[];
    empty_reason: string | null;
}

// ─── SFX Types ───────────────────────────────────────────────────────────────

export interface SFXSuggestion {
    cue_id: string;
    cue_text: string;
    start_ms: number;
    end_ms?: number;
    trim_start_ms?: number;
    trim_end_ms?: number;
    score: number;
    matched_tags: string[];
    placement_reason: string;
    source: 'cloudinary';
    sfx: {
        name: string;
        file_url: string;
        mood: string[];
        duration: number;
    };
}

export interface SFXSuggestionsResult {
    suggestions: SFXSuggestion[];
    empty_reason: string | null;
}

// ─── Transition Types ─────────────────────────────────────────────────────────

export interface TransitionSuggestion {
    clip_id: string;
    offset_ms: number;
    end_ms: number;
    type: string;
    duration_s: number;
}

// ─── Crop Types ───────────────────────────────────────────────────────────────

export interface CropResult {
    output_path: string;
    width: number;
    height: number;
    subject_x_pct: number;
    method: string;
}

export const orchestratorApi = {
    run: (
        projectId: string,
        agents: string[],
        options?: { aspect_ratio?: string; transition_style?: string },
    ) =>
        api.post<{ job_id: string; status: string; agents: string[] }>(
            `/v1/orchestrator/${projectId}/run`,
            { agents, ...options },
            { timeout: 30_000 },
        ),
    status: (projectId: string) =>
        api.get<OrchestrationStatus>(`/v1/orchestrator/${projectId}/status`),
    /** Returns the SSE URL — caller should open with EventSource (with auth token as query param). */
    streamUrl: (projectId: string, token: string) =>
        `${API_BASE_URL}/v1/orchestrator/${projectId}/stream?token=${encodeURIComponent(token)}`,
};

export const sfxApi = {
    suggest: (projectId: string) =>
        api.post<{ suggestions: SFXSuggestion[] }>(
            `/v1/orchestrator/${projectId}/run`,
            { agents: ['sfx'] },
            { timeout: 120_000 },
        ),
};

export const transitionsApi = {
    build: (projectId: string, style: string = 'auto') =>
        api.post<{ suggestions: TransitionSuggestion[] }>(
            `/v1/orchestrator/${projectId}/run`,
            { agents: ['transitions'], transition_style: style },
            { timeout: 60_000 },
        ),
};

export const cropApi = {
    crop: (projectId: string, targetRatio: '16:9' | '9:16') =>
        api.post<CropResult>(
            `/v1/orchestrator/${projectId}/run`,
            { agents: ['crop'], aspect_ratio: targetRatio },
            { timeout: 300_000 },
        ),
};

export interface LongToShortItem {
    short_id: string;
    title: string;
    start_ms: number;
    end_ms: number;
    duration_sec: number;
    engagement_rate: number;
    primary_caption: string;
    captions: string[];
    caption_cues?: LongToShortCaptionCue[];
    aspect_ratio: '9:16' | '16:9';
    caption_style?: string;
    reframe_mode?: 'person_center' | 'fit_blur' | 'none';
    selection_engine?: string;
    viral_reason?: string;
    assembly_mode?: 'continuous' | 'multi_segment' | string;
    source_segments?: Array<{
        start_ms: number;
        end_ms: number;
    }>;
    chapter?: {
        chapter_index?: number;
        start_ms?: number;
        end_ms?: number;
        topic_keywords?: string[];
        summary?: string;
    };
    score_breakdown?: {
        hook_quality?: number;
        emotional_intensity?: number;
        topic_trend_alignment?: number;
        audio_engagement?: number;
        standalone_coherence?: number;
        filler_word_penalty?: number;
        mid_sentence_start_penalty?: number;
        visual_action?: number;
    };
    cut_quality?: {
        mode?: string;
        first_word_start_ms?: number;
        last_word_end_ms?: number;
        lead_padding_ms?: number;
        tail_padding_ms?: number;
    };
}

export interface LongToShortCaptionCue {
    id?: string;
    text: string;
    start_ms: number;
    end_ms: number;
    relative_start_ms?: number;
    relative_end_ms?: number;
    highlight_words?: string[];
    important_words?: string[];
    emoji?: string;
    emoji_start_ms?: number;
    emoji_end_ms?: number;
    emoji_relative_start_ms?: number;
    emoji_relative_end_ms?: number;
    words?: Array<{
        word?: string;
        text?: string;
        start_ms?: number;
        end_ms?: number;
        relative_start_ms?: number;
        relative_end_ms?: number;
    }>;
}

export interface LongToShortAnalysisResponse {
    job_id: string;
    project_id: string;
    status: string;
    track_id: string;
    shorts_count: number;
    target_count?: number;
    requested_target_count?: number;
    auto_clip_count?: boolean;
    target_aspect_ratio?: '9:16' | '16:9';
    caption_style?: string;
    reframe_mode?: 'person_center' | 'fit_blur' | 'none';
    selection_engine?: string;
    reframe?: {
        path?: string;
        target_ratio?: string;
        method?: string;
        subject_x_pct?: number;
    } | null;
    warnings?: string[];
    shorts: LongToShortItem[];
}

export interface LongToShortLatestResponse {
    job_id?: string;
    project_id?: string;
    status: string;
    shorts_count?: number;
    target_count?: number;
    requested_target_count?: number;
    auto_clip_count?: boolean;
    min_duration_sec?: number;
    max_duration_sec?: number;
    target_aspect_ratio?: '9:16' | '16:9';
    caption_style?: string;
    reframe_mode?: 'person_center' | 'fit_blur' | 'none';
    selection_engine?: string;
    track_id?: string;
    reframe?: {
        path?: string;
        target_ratio?: string;
        method?: string;
        subject_x_pct?: number;
    } | null;
    warnings?: string[];
    shorts?: LongToShortItem[];
    created_at?: string;
    completed_at?: string;
    message?: string;
}

export interface LongToShortYouTubeImportResponse {
    project_id: string;
    status: string;
    youtube_url: string;
    title: string;
    duration_sec: number;
    message: string;
}

export interface LongToShortPreflightResponse {
    status: 'ok' | 'needs_attention';
    checks: {
        groq_api_key_configured: boolean;
        groq_api_key_valid: boolean;
        yt_dlp_available: boolean;
        ffmpeg_available: boolean;
        ffprobe_available: boolean;
        credits_remaining: number;
        can_start_transcription: boolean;
    };
    issues: string[];
}

export const longToShortsApi = {
    preflight: () =>
        api.get<LongToShortPreflightResponse>('/v1/long-to-shorts/preflight'),
    importYouTube: (youtube_url: string, project_name?: string) =>
        api.post<LongToShortYouTubeImportResponse>(
            '/v1/long-to-shorts/youtube',
            { youtube_url, project_name: project_name || undefined },
            { timeout: 900_000 },
        ),
    analyze: (
        projectId: string,
        options?: {
            target_count?: number;
            min_duration_sec?: number;
            max_duration_sec?: number;
            target_aspect_ratio?: '9:16' | '16:9';
            reframe_mode?: 'person_center' | 'fit_blur' | 'none';
            caption_style?: 'comic_story' | 'clean_modern' | 'subtitle_minimal';
        },
    ) =>
        api.post<LongToShortAnalysisResponse>(
            `/v1/long-to-shorts/${projectId}/analyze`,
            {
                target_count: options?.target_count ?? 0,
                min_duration_sec: options?.min_duration_sec ?? 15,
                max_duration_sec: options?.max_duration_sec ?? 45,
                target_aspect_ratio: options?.target_aspect_ratio ?? '9:16',
                reframe_mode: options?.reframe_mode ?? 'person_center',
                caption_style: options?.caption_style ?? 'comic_story',
            },
            { timeout: 900_000 },
        ),
    getLatest: (projectId: string) =>
        api.get<LongToShortLatestResponse>(`/v1/long-to-shorts/${projectId}`),
    downloadShort: (projectId: string, shortId: string) =>
        api.get<Blob>(`/v1/long-to-shorts/${projectId}/shorts/${shortId}/download`, {
            responseType: 'blob',
            timeout: 900_000,
        }),
};

export type SocialSchedulerStatus = 'draft' | 'ready' | 'scheduled' | 'published';

export interface SocialPlatformConnection {
    id: string;
    name: string;
    channel_type: string;
    character_limit: number;
    supports_video: boolean;
    recommended_ratio: '9:16' | '16:9' | string;
    status: 'connected' | 'not_connected' | 'setup_required' | string;
    connected: boolean;
    oauth_configured?: boolean;
    account_name?: string | null;
    last_checked_at?: string | null;
}

export interface SocialSchedulerPost {
    id: string;
    title: string;
    caption: string;
    platforms: string[];
    status: SocialSchedulerStatus;
    scheduled_at?: string | null;
    timezone: string;
    project_id?: string | null;
    short_id?: string | null;
    asset_url?: string | null;
    campaign?: string | null;
    tags: string[];
    publish_results?: Array<Record<string, unknown>>;
    publish_status?: 'idle' | 'scheduled' | 'processing' | 'complete' | 'error' | string;
    publish_summary?: Record<string, unknown>;
    last_error?: string | null;
    published_at?: string | null;
    created_at: string;
    updated_at: string;
}

export type SocialSchedulerPostPayload = {
    title: string;
    caption?: string;
    platforms?: string[];
    status?: SocialSchedulerStatus;
    scheduled_at?: string | null;
    timezone?: string;
    project_id?: string | null;
    short_id?: string | null;
    asset_url?: string | null;
    campaign?: string | null;
    tags?: string[];
};

export const socialSchedulerApi = {
    platforms: () =>
        api.get<{ platforms: SocialPlatformConnection[] }>('/v1/social-scheduler/platforms'),
    startOAuth: (platformId: string) =>
        api.get<{
            authorization_url: string;
            platform_id: string;
            redirect_uri: string;
            expires_at: string;
        }>(`/v1/social-scheduler/oauth/${platformId}/start`),
    prepareConnection: (platformId: string) =>
        api.post<{
            platform_id: string;
            status: string;
            connected: boolean;
            message: string;
        }>(`/v1/social-scheduler/connections/${platformId}`),
    posts: (status?: SocialSchedulerStatus) =>
        api.get<{ items: SocialSchedulerPost[] }>('/v1/social-scheduler/posts', {
            params: status ? { status } : undefined,
        }),
    createPost: (payload: SocialSchedulerPostPayload) =>
        api.post<SocialSchedulerPost>('/v1/social-scheduler/posts', payload),
    updatePost: (postId: string, payload: Partial<SocialSchedulerPostPayload>) =>
        api.patch<SocialSchedulerPost>(`/v1/social-scheduler/posts/${postId}`, payload),
    publishPost: (postId: string) =>
        api.post<{ post_id: string; status: SocialSchedulerStatus; results: Array<Record<string, unknown>> }>(`/v1/social-scheduler/posts/${postId}/publish`),
    deletePost: (postId: string) =>
        api.delete(`/v1/social-scheduler/posts/${postId}`),
};
