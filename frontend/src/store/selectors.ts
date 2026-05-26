// src/store/selectors.ts
// Memoised selectors over `useTimeline`.
// These run 60x/sec during playback - they MUST be pure slice selectors.
import { useTimeline } from './timelineStore';

/** Active subtitle cues at the current playback position. */
export const useActiveCues = () =>
    useTimeline((s) =>
        s.subtitleTrack.filter(
            (c) => c.start_ms <= s.currentTimeMs && c.end_ms > s.currentTimeMs,
        ),
    );

/** Active B-roll clip at the current playback position (first match). */
export const useActiveBroll = () =>
    useTimeline((s) =>
        s.brollTrack.find(
            (b) => b.start_ms <= s.currentTimeMs && b.end_ms > s.currentTimeMs,
        ) ?? null,
    );

/** Visible timeline window in ms (based on zoom + scroll offset). */
export const useVisibleRange = () =>
    useTimeline((s) => ({
        startMs: s.scrollOffsetMs,
        endMs: s.scrollOffsetMs + (window.innerWidth / s.zoom) * 1000,
    }));

/** Currently selected cue (full object). */
export const useSelectedCue = () =>
    useTimeline((s) =>
        s.selectedCueId
            ? (s.subtitleTrack.find((c) => c._id === s.selectedCueId) ?? null)
            : null,
    );

/** Playback progress as a fraction 0–1. */
export const useProgress = () =>
    useTimeline((s) => (s.durationMs > 0 ? s.currentTimeMs / s.durationMs : 0));
