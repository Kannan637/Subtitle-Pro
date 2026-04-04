export type Plan = 'FREE' | 'CREATOR' | 'STUDIO' | 'ENTERPRISE';
export type JobStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'ERROR';
export type JobType = 'TRANSCRIPTION' | 'TRANSLATION' | 'MEDIA_PROCESSING' | 'BURN_IN';

export interface User {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    plan: Plan;
    creditsRemainingS: number;
    isVerified: boolean;
    createdAt: string;
}

export interface Project {
    id: string;
    userId: string;
    name: string;
    status: JobStatus;
    durationSec: number | null;
    thumbnailUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SubtitleTrack {
    id: string;
    projectId: string;
    languageCode: string;
    isOriginal: boolean;
    createdBy: 'ai' | 'human';
    version: number;
    createdAt: string;
}

export interface SubtitleCue {
    id: string;
    trackId: string;
    sequence: number;
    startMs: number;
    endMs: number;
    text: string;
    speakerId: string | null;
    confidence: number | null;
    linePosition: 'top' | 'bottom' | null;
}

export interface Job {
    id: string;
    projectId: string;
    type: JobType;
    status: JobStatus;
    modelUsed: string | null;
    errorMsg: string | null;
    progress: number;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: {
        page: number;
        total: number;
        pageSize: number;
    };
}

export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}
