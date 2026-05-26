// src/components/Timeline/VirtualTimeline.tsx
// Renders only the subtitle cue blocks visible in the current timeline window
// (plus a 2s buffer on each side). Prevents 1000+ DOM nodes for long videos.

import React, { useMemo } from 'react';
import { useTimeline } from '@/store/timelineStore';
import { useVisibleRange } from '@/store/selectors';
import type { SubtitleCue } from '@/lib/api';

const getCueId = (cue: SubtitleCue) => cue._id || cue.id || "";

interface CueBlockProps {
    cue: SubtitleCue;
    zoom: number;         // px per second
    scrollOffsetMs: number;
    isSelected: boolean;
    onClick: (id: string) => void;
}

const CueBlock: React.FC<CueBlockProps> = ({ cue, zoom, scrollOffsetMs, isSelected, onClick }) => {
    const left = ((cue.start_ms - scrollOffsetMs) / 1000) * zoom;
    const width = Math.max(2, ((cue.end_ms - cue.start_ms) / 1000) * zoom);

    return (
        <div
            onClick={() => onClick(getCueId(cue))}
            title={cue.text}
            style={{
                position: 'absolute',
                left: `${left}px`,
                width: `${width}px`,
                top: '4px',
                bottom: '4px',
                borderRadius: '4px',
                background: isSelected
                    ? 'rgba(99, 102, 241, 0.9)'
                    : 'rgba(99, 102, 241, 0.55)',
                border: isSelected ? '2px solid #818cf8' : '1px solid rgba(99, 102, 241, 0.7)',
                cursor: 'pointer',
                padding: '2px 4px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                fontSize: '10px',
                color: '#fff',
                lineHeight: '1.2',
                boxSizing: 'border-box',
                transition: 'background 0.1s',
            }}
        >
            {width > 30 ? cue.text : ''}
        </div>
    );
};

export const VirtualTimeline: React.FC = () => {
    const subtitleTrack = useTimeline((s) => s.subtitleTrack);
    const selectedCueId = useTimeline((s) => s.selectedCueId);
    const zoom = useTimeline((s) => s.zoom);
    const scrollOffsetMs = useTimeline((s) => s.scrollOffsetMs);
    const selectCue = useTimeline((s) => s.selectCue);
    const durationMs = useTimeline((s) => s.durationMs);
    const { startMs, endMs } = useVisibleRange();

    // Only render cues in the visible window + 2s buffer on each side
    const visibleCues = useMemo(
        () =>
            subtitleTrack.filter(
                (c) => getCueId(c) && c.end_ms > startMs - 2000 && c.start_ms < endMs + 2000,
            ),
        [subtitleTrack, startMs, endMs],
    );

    const totalWidth = (durationMs / 1000) * zoom;

    return (
        <div
            style={{
                position: 'relative',
                height: '48px',
                width: `${totalWidth}px`,
                minWidth: '100%',
                background: 'rgba(15, 15, 25, 0.9)',
                borderTop: '1px solid rgba(99, 102, 241, 0.2)',
            }}
        >
            {visibleCues.map((cue) => (
                <CueBlock
                    key={getCueId(cue)}
                    cue={cue}
                    zoom={zoom}
                    scrollOffsetMs={scrollOffsetMs}
                    isSelected={getCueId(cue) === selectedCueId}
                    onClick={selectCue}
                />
            ))}
        </div>
    );
};

export default VirtualTimeline;
