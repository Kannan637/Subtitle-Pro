// src/store/timelineStore.ts
// Central Zustand store for all timeline state.
// Subscribe to specific slices using selectors.ts to avoid unnecessary re-renders.
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SubtitleCue, BrollClip, BrollSuggestion, MotionGraphicSuggestion } from '@/lib/api';

// ─── Track types ──────────────────────────────────────────────────────────────

export interface MusicClip {
    id: string;
    name: string;
    preview_url: string | null;
    start_ms: number;
    duration: number;
    end_ms?: number;
    trim_start_ms?: number;
    trim_end_ms?: number;
    volume_db?: number;
}

export interface SFXClip {
    id: string;
    name: string;
    file_url: string;
    mood: string[];
    duration: number;
    start_ms: number;
    end_ms?: number;
    trim_start_ms?: number;
    trim_end_ms?: number;
    volume_db?: number;
}

export interface TransitionClip {
    clip_id: string;
    offset_ms: number;
    end_ms: number;
    type: string;
    duration_s: number;
}

export interface GapCut {
    start_ms: number;
    end_ms: number;
    duration_ms: number;
    type: 'silence';
}

export interface BrollTrackClip extends BrollClip {
    start_ms: number;
    end_ms: number;
    cue_text?: string;
}

export interface MotionGraphicTrackClip extends MotionGraphicSuggestion {
    cue_text?: string;
}

export interface EffectsState {
    colorGrade: 'cinematic' | 'natural' | 'warm' | null;
    lutPath: string | null;
    brightness: number; // 0–2, 1 = normal
    contrast: number;   // 0–2, 1 = normal
}

export type AgentName = 'broll' | 'music' | 'gaps' | 'sfx' | 'transitions' | 'crop';
export type AgentState = 'idle' | 'queued' | 'running' | 'complete' | 'error';

// ─── Store interface ──────────────────────────────────────────────────────────

export interface TimelineHistorySnapshot {
    subtitleTrack: SubtitleCue[];
    brollTrack: BrollTrackClip[];
    motionGraphicsTrack: MotionGraphicTrackClip[];
    musicTrack: MusicClip | null;
    sfxTrack: SFXClip[];
    transitions: TransitionClip[];
    gapCuts: GapCut[];
}

interface TimelineState {
    // Project context
    projectId: string | null;
    projectName: string;
    videoBlobUrl: string | null;
    aspectRatio: '16:9' | '9:16';

    // Playback
    currentTimeMs: number;
    durationMs: number;
    isPlaying: boolean;
    playbackRate: number;

    // Tracks
    subtitleTrack: SubtitleCue[];
    brollTrack: BrollTrackClip[];
    brollSuggestions: BrollSuggestion[];
    motionGraphicsTrack: MotionGraphicTrackClip[];
    motionGraphicsSuggestions: MotionGraphicSuggestion[];
    musicTrack: MusicClip | null;
    sfxTrack: SFXClip[];
    transitions: TransitionClip[];
    gapCuts: GapCut[];

    historyPast: TimelineHistorySnapshot[];
    historyFuture: TimelineHistorySnapshot[];

    // AI Agent status
    agentStatus: Record<AgentName, AgentState>;
    jobId: string | null;

    // Selection
    selectedCueId: string | null;
    selectedTemplate: string | null;
    customStyle: Record<string, any>;
    zoom: number;           // px per second
    scrollOffsetMs: number;

    // Effects (applied only at export time)
    effects: EffectsState;

    // Actions — project
    setProjectId: (id: string | null) => void;
    setProjectName: (name: string) => void;
    setVideoBlobUrl: (url: string | null) => void;
    setAspectRatio: (r: '16:9' | '9:16') => void;

    // Actions — playback
    setTime: (ms: number) => void;
    setDuration: (ms: number) => void;
    setPlaying: (v: boolean) => void;
    setPlaybackRate: (rate: number) => void;

    // Actions — tracks
    setSubtitleTrack: (cues: SubtitleCue[]) => void;
    updateCue: (id: string, patch: Partial<SubtitleCue>) => void;
    removeCue: (id: string) => void;

    addBroll: (clip: BrollTrackClip) => void;
    removeBroll: (pexelsId: string) => void;
    updateBroll: (pexelsId: string, patch: Partial<BrollTrackClip>) => void;
    setBrollTrack: (clips: BrollTrackClip[]) => void;
    setBrollSuggestions: (suggestions: BrollSuggestion[]) => void;

    addMotionGraphic: (clip: MotionGraphicTrackClip) => void;
    removeMotionGraphic: (clipId: string) => void;
    updateMotionGraphic: (clipId: string, patch: Partial<MotionGraphicTrackClip>) => void;
    setMotionGraphicsTrack: (clips: MotionGraphicTrackClip[]) => void;
    setMotionGraphicsSuggestions: (suggestions: MotionGraphicSuggestion[]) => void;

    setMusicTrack: (clip: MusicClip | null) => void;
    updateMusic: (patch: Partial<MusicClip>) => void;

    setSFXTrack: (clips: SFXClip[]) => void;
    updateSFX: (id: string, patch: Partial<SFXClip>) => void;
    removeSFX: (id: string) => void;

    setTransitions: (clips: TransitionClip[]) => void;
    setGapCuts: (gaps: GapCut[]) => void;

    // Actions — agent status
    setAgentStatus: (agent: AgentName, state: AgentState) => void;
    setAgentStatusBulk: (statuses: Partial<Record<AgentName, AgentState>>) => void;
    setJobId: (id: string | null) => void;

    // Actions — selection
    selectCue: (id: string | null) => void;
    setSelectedTemplate: (id: string | null) => void;
    setCustomStyle: (patch: Record<string, any>) => void;
    replaceCustomStyle: (style: Record<string, any>) => void;
    clearCustomStyle: () => void;
    setZoom: (z: number) => void;
    setScrollOffset: (ms: number) => void;
    setEffect: (patch: Partial<EffectsState>) => void;
    undo: () => void;
    redo: () => void;

    reset: () => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_EFFECTS: EffectsState = {
    colorGrade: null,
    lutPath: null,
    brightness: 1,
    contrast: 1,
};

const HISTORY_LIMIT = 60;
const MIN_BROLL_DURATION_MS = 34; // ~1 frame @ 30fps
const MAX_BROLL_DURATION_MS = 3000;
const MIN_MOTION_DURATION_MS = 100;
const MAX_MOTION_DURATION_MS = 3000;

function normalizeBrollClip<T extends { start_ms: number; end_ms: number }>(
    clip: T,
    durationMs: number = 0,
): T {
    const hasDuration = Number.isFinite(durationMs) && durationMs > 0;
    const maxStart = hasDuration ? Math.max(0, Math.round(durationMs) - MIN_BROLL_DURATION_MS) : Number.POSITIVE_INFINITY;
    const startMs = Math.max(0, Math.min(Math.round(Number(clip.start_ms) || 0), maxStart));

    const requestedRaw = Number(clip.end_ms);
    const requestedEnd = Number.isFinite(requestedRaw) && requestedRaw > startMs
        ? Math.round(requestedRaw)
        : startMs + MIN_BROLL_DURATION_MS;

    const hardMaxEnd = startMs + MAX_BROLL_DURATION_MS;
    const durationCap = hasDuration ? Math.round(durationMs) : Number.POSITIVE_INFINITY;
    const cappedEnd = Math.min(requestedEnd, hardMaxEnd, durationCap);
    const endMs = cappedEnd > startMs ? cappedEnd : Math.min(startMs + MIN_BROLL_DURATION_MS, hardMaxEnd, durationCap);
    return { ...clip, start_ms: startMs, end_ms: Math.max(startMs + 1, endMs) };
}

function normalizeMotionGraphicClip<T extends { start_ms: number; end_ms: number }>(
    clip: T,
    durationMs: number = 0,
): T {
    const hasDuration = Number.isFinite(durationMs) && durationMs > 0;
    const maxStart = hasDuration ? Math.max(0, Math.round(durationMs) - MIN_MOTION_DURATION_MS) : Number.POSITIVE_INFINITY;
    const startMs = Math.max(0, Math.min(Math.round(Number(clip.start_ms) || 0), maxStart));
    const requestedRaw = Number(clip.end_ms);
    const requestedEnd = Number.isFinite(requestedRaw) && requestedRaw > startMs
        ? Math.round(requestedRaw)
        : startMs + MIN_MOTION_DURATION_MS;
    const cappedEnd = Math.min(requestedEnd, startMs + MAX_MOTION_DURATION_MS, hasDuration ? Math.round(durationMs) : Number.POSITIVE_INFINITY);
    const endMs = cappedEnd > startMs ? cappedEnd : startMs + MIN_MOTION_DURATION_MS;
    return { ...clip, start_ms: startMs, end_ms: Math.max(startMs + 1, endMs) };
}

const getSubtitleCueId = (cue: SubtitleCue) => cue._id || cue.id || "";
const snapshotTimeline = (s: TimelineState): TimelineHistorySnapshot => ({
    subtitleTrack: s.subtitleTrack,
    brollTrack: s.brollTrack,
    motionGraphicsTrack: s.motionGraphicsTrack,
    musicTrack: s.musicTrack,
    sfxTrack: s.sfxTrack,
    transitions: s.transitions,
    gapCuts: s.gapCuts,
});
const withHistory = (s: TimelineState) => ({
    historyPast: [...s.historyPast.slice(-(HISTORY_LIMIT - 1)), snapshotTimeline(s)],
    historyFuture: [],
});

const DEFAULT_AGENT_STATUS: Record<AgentName, AgentState> = {
    broll: 'idle',
    music: 'idle',
    gaps: 'idle',
    sfx: 'idle',
    transitions: 'idle',
    crop: 'idle',
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTimeline = create<TimelineState>()(
    subscribeWithSelector((set, _get) => ({
        // Project context
        projectId: null,
        projectName: 'Untitled',
        videoBlobUrl: null,
        aspectRatio: '16:9',

        // Playback
        currentTimeMs: 0,
        durationMs: 0,
        isPlaying: false,
        playbackRate: 1,

        // Tracks
        subtitleTrack: [],
        brollTrack: [],
        brollSuggestions: [],
        motionGraphicsTrack: [],
        motionGraphicsSuggestions: [],
        musicTrack: null,
        sfxTrack: [],
        transitions: [],
        gapCuts: [],
        historyPast: [],
        historyFuture: [],

        // Agent status
        agentStatus: { ...DEFAULT_AGENT_STATUS },
        jobId: null,

        // Selection
        selectedCueId: null,
        selectedTemplate: null,
        customStyle: {},
        zoom: 100,
        scrollOffsetMs: 0,

        // Effects
        effects: { ...DEFAULT_EFFECTS },

        // ── Actions ──────────────────────────────────────────────────────────

        setProjectId: (id) => set({ projectId: id }),
        setProjectName: (name) => set({ projectName: name }),
        setVideoBlobUrl: (url) => set({ videoBlobUrl: url }),
        setAspectRatio: (r) => set({ aspectRatio: r }),

        setTime: (ms) => set({ currentTimeMs: ms }),
        setDuration: (ms) => set({ durationMs: ms }),
        setPlaying: (v) => set({ isPlaying: v }),
        setPlaybackRate: (rate) => set({ playbackRate: rate }),

        setSubtitleTrack: (cues) => set((s) => ({ ...withHistory(s), subtitleTrack: cues })),
        updateCue: (id, patch) => set((s) => ({ ...withHistory(s), subtitleTrack: s.subtitleTrack.map((c) => getSubtitleCueId(c) === id ? { ...c, ...patch } : c) })),
        removeCue: (id) => set((s) => ({ ...withHistory(s), subtitleTrack: s.subtitleTrack.filter(c => getSubtitleCueId(c) !== id) })),

        addBroll: (clip) => set((s) => {
            if (s.brollTrack.some((b) => String(b.pexels_id) === String(clip.pexels_id))) return {};
            const normalized = normalizeBrollClip(clip, s.durationMs);
            return { ...withHistory(s), brollTrack: [...s.brollTrack, normalized] };
        }),
        removeBroll: (pexelsId) => set((s) => ({ ...withHistory(s), brollTrack: s.brollTrack.filter((b) => String(b.pexels_id) !== String(pexelsId)) })),
        updateBroll: (pexelsId, patch) => set((s) => ({
            ...withHistory(s),
            brollTrack: s.brollTrack.map((b) =>
                String(b.pexels_id) === String(pexelsId)
                    ? normalizeBrollClip({ ...b, ...patch }, s.durationMs)
                    : b
            )
        })),
        setBrollTrack: (clips) => set((s) => ({
            ...withHistory(s),
            brollTrack: clips.map((c) => normalizeBrollClip(c, s.durationMs)),
        })),
        setBrollSuggestions: (suggestions) => set({ brollSuggestions: suggestions }),

        addMotionGraphic: (clip) => set((s) => {
            if (s.motionGraphicsTrack.some((item) => String(item.clip_id) === String(clip.clip_id))) return {};
            const normalized = normalizeMotionGraphicClip(clip, s.durationMs);
            return { ...withHistory(s), motionGraphicsTrack: [...s.motionGraphicsTrack, normalized] };
        }),
        removeMotionGraphic: (clipId) => set((s) => ({ ...withHistory(s), motionGraphicsTrack: s.motionGraphicsTrack.filter((item) => String(item.clip_id) !== String(clipId)) })),
        updateMotionGraphic: (clipId, patch) => set((s) => ({
            ...withHistory(s),
            motionGraphicsTrack: s.motionGraphicsTrack.map((item) =>
                String(item.clip_id) === String(clipId)
                    ? normalizeMotionGraphicClip({ ...item, ...patch }, s.durationMs)
                    : item
            ),
        })),
        setMotionGraphicsTrack: (clips) => set((s) => ({
            ...withHistory(s),
            motionGraphicsTrack: clips.map((clip) => normalizeMotionGraphicClip(clip, s.durationMs)),
        })),
        setMotionGraphicsSuggestions: (suggestions) => set({ motionGraphicsSuggestions: suggestions }),

        setMusicTrack: (clip) => set((s) => ({ ...withHistory(s), musicTrack: clip })),
        updateMusic: (patch) => set((s) => ({ ...withHistory(s), musicTrack: s.musicTrack ? { ...s.musicTrack, ...patch } : null })),

        setSFXTrack: (clips) => set((s) => ({ ...withHistory(s), sfxTrack: clips })),
        updateSFX: (id, patch) => set((s) => ({ ...withHistory(s), sfxTrack: s.sfxTrack.map((c) => c.id === id ? { ...c, ...patch } : c) })),
        removeSFX: (id) => set((s) => ({ ...withHistory(s), sfxTrack: s.sfxTrack.filter(c => c.id !== id) })),
        setTransitions: (clips) => set((s) => ({ ...withHistory(s), transitions: clips })),
        setGapCuts: (gaps) => set((s) => ({ ...withHistory(s), gapCuts: gaps })),

        setAgentStatus: (agent, state) =>
            set((s) => ({
                agentStatus: { ...s.agentStatus, [agent]: state },
            })),
        setAgentStatusBulk: (statuses) =>
            set((s) => ({
                agentStatus: { ...s.agentStatus, ...statuses },
            })),
        setJobId: (id) => set({ jobId: id }),

        selectCue: (id) => set({ selectedCueId: id }),
        setSelectedTemplate: (id) => set({ selectedTemplate: id }),
        setCustomStyle: (patch) => set((s) => ({ customStyle: { ...s.customStyle, ...patch } })),
        replaceCustomStyle: (style) => set({ customStyle: { ...style } }),
        clearCustomStyle: () => set({ customStyle: {} }),
        setZoom: (z) => set({ zoom: Math.max(20, Math.min(500, z)) }),
        setScrollOffset: (ms) => set({ scrollOffsetMs: Math.max(0, ms) }),
        setEffect: (patch) =>
            set((s) => ({ effects: { ...s.effects, ...patch } })),
        undo: () => set((s) => {
            const previous = s.historyPast.at(-1);
            if (!previous) return {};
            return { ...previous, historyPast: s.historyPast.slice(0, -1), historyFuture: [snapshotTimeline(s), ...s.historyFuture].slice(0, HISTORY_LIMIT) };
        }),
        redo: () => set((s) => {
            const next = s.historyFuture[0];
            if (!next) return {};
            return { ...next, historyPast: [...s.historyPast.slice(-(HISTORY_LIMIT - 1)), snapshotTimeline(s)], historyFuture: s.historyFuture.slice(1) };
        }),

        reset: () =>
            set({
                projectId: null,
                projectName: 'Untitled',
                videoBlobUrl: null,
                aspectRatio: '16:9',
                currentTimeMs: 0,
                durationMs: 0,
                isPlaying: false,
                playbackRate: 1,
                subtitleTrack: [],
                brollTrack: [],
                brollSuggestions: [],
                motionGraphicsTrack: [],
                motionGraphicsSuggestions: [],
                musicTrack: null,
                sfxTrack: [],
                transitions: [],
                gapCuts: [],
                historyPast: [],
                historyFuture: [],
                agentStatus: { ...DEFAULT_AGENT_STATUS },
                jobId: null,
                selectedCueId: null,
                selectedTemplate: null,
                zoom: 100,
                scrollOffsetMs: 0,
                effects: { ...DEFAULT_EFFECTS },
            }),
    })),
);
