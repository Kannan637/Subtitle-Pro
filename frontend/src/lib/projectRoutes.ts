import type { Project } from './api';

export function normalizeProjectType(type?: string | null): string {
    return (type || 'subtitle').trim().toLowerCase();
}

export function isVideoCaptionProject(project: Pick<Project, 'type'>): boolean {
    const type = normalizeProjectType(project.type);
    return [
        'caption',
        'video-caption',
        'video_caption',
        'ai-video-caption',
        'ai_video_caption',
    ].includes(type);
}

export function isLongToShortsProject(project: Pick<Project, 'type'>): boolean {
    const type = normalizeProjectType(project.type);
    return type === 'long_to_shorts' || type === 'long-to-shorts';
}

export function normalizeProjectId(id?: string | null): string | null {
    const value = String(id ?? '').trim();
    if (!value || ['null', 'undefined', 'new'].includes(value.toLowerCase())) {
        return null;
    }
    return value;
}

export function getProjectOpenPath(project: Pick<Project, 'id' | 'type'>): string {
    const projectId = normalizeProjectId(project.id);
    if (!projectId) {
        return '/dashboard';
    }

    if (isLongToShortsProject(project)) {
        return `/dashboard/long-to-shorts/studio?project=${encodeURIComponent(projectId)}`;
    }

    if (isVideoCaptionProject(project)) {
        return `/dashboard/caption-editor/${projectId}`;
    }

    return `/dashboard/video-editor/${projectId}`;
}

export function getProjectTypeLabel(project: Pick<Project, 'type'>): string {
    if (isLongToShortsProject(project)) return 'Long to Viral';
    if (isVideoCaptionProject(project)) return 'AI Caption';
    return 'AI Subtitle';
}
