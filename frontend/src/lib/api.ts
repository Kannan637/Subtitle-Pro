import axios from 'axios';
import { auth } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 120_000, // 2 min for transcription/translation
});

// Inject Firebase auth token on every request
api.interceptors.request.use(async (config) => {
    const currentUser = auth.currentUser;
    if (currentUser) {
        const token = await currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 — force token refresh and retry once
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401 && auth.currentUser) {
            try {
                const token = await auth.currentUser.getIdToken(true);
                error.config.headers.Authorization = `Bearer ${token}`;
                return api.request(error.config);
            } catch {
                // Token refresh failed
            }
        }
        return Promise.reject(error);
    }
);

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

export interface SubtitleCue {
    _id: string;
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
        reference: string;
        note: string;
        created_at: string;
    }>;
}

// ─── API Clients ─────────────────────────────────────────────────────────────

export const projectsApi = {
    list: () => api.get<Project[]>('/v1/projects/'),
    create: (name: string, type: string = 'subtitle') => api.post<Project>('/v1/projects/', { name, type }),
    get: (id: string) => api.get<Project>(`/v1/projects/${id}`),
    delete: (id: string) => api.delete(`/v1/projects/${id}`),
};

export const mediaApi = {
    upload: (projectId: string, file: File, onUploadProgress?: (e: any) => void) => {
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('file', file);
        return api.post('/v1/media/upload', formData, {
            timeout: 300_000, // 5 min for large uploads
            onUploadProgress,
        });
    },
    getStreamUrl: (projectId: string) =>
        `${API_BASE_URL}/v1/media/stream/${projectId}`,
    /** Fetch a blob URL with auth for HTML5 <video> src */
    getAuthenticatedStreamUrl: async (projectId: string): Promise<string> => {
        const res = await api.get(`/v1/media/stream/${projectId}`, {
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
            timeout: 300_000,
        }),
    get: (projectId: string) =>
        api.get(`/v1/transcription/${projectId}`),
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
        api.put(`/v1/subtitles/track/${projectId}`, { cues }),
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
    mp4: (projectId: string, cues: Array<{ text: string; start_ms: number; end_ms: number }>, style?: Record<string, any>) =>
        api.post(`/v1/export/${projectId}/mp4`, { cues, style }, {
            responseType: 'blob',
            timeout: 600_000, // 10 min for rendering
        }),
};
