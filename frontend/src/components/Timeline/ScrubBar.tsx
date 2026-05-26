// src/components/Timeline/ScrubBar.tsx
// Throttled timeline scrubber — limits pointer-move events to 20/sec during drag.
// This prevents the timeline from feeling "sticky" when scrubbing on slow machines.

import React, { useCallback, useRef, useState } from 'react';
import { useTimeline } from '@/store/timelineStore';

const SCRUB_THROTTLE_MS = 50; // max 20 updates/sec while dragging

interface ScrubBarProps {
    /** Total duration in milliseconds. */
    durationMs: number;
    /** Called when user seeks to a new position. */
    onSeek: (ms: number) => void;
}

export const ScrubBar: React.FC<ScrubBarProps> = ({ durationMs, onSeek }) => {
    const currentTimeMs = useTimeline((s) => s.currentTimeMs);
    const barRef = useRef<HTMLDivElement>(null);
    const lastUpdateRef = useRef<number>(0);
    const isDragging = useRef(false);
    const [dragging, setDragging] = useState(false);

    const computeTimeFromX = useCallback(
        (clientX: number): number => {
            if (!barRef.current) return 0;
            const rect = barRef.current.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return ratio * durationMs;
        },
        [durationMs],
    );

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            isDragging.current = true;
            setDragging(true);
            const ms = computeTimeFromX(e.clientX);
            onSeek(ms);
            lastUpdateRef.current = Date.now();
        },
        [computeTimeFromX, onSeek],
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!isDragging.current) return;
            const now = Date.now();
            if (now - lastUpdateRef.current < SCRUB_THROTTLE_MS) return;
            lastUpdateRef.current = now;
            const ms = computeTimeFromX(e.clientX);
            onSeek(ms);
        },
        [computeTimeFromX, onSeek],
    );

    const handlePointerUp = useCallback(() => {
        isDragging.current = false;
        setDragging(false);
    }, []);

    const progressPercent = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

    return (
        <div
            ref={barRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
                position: 'relative',
                width: '100%',
                height: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '3px',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'none',
            }}
            aria-label="Timeline scrubber"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={durationMs}
            aria-valuenow={currentTimeMs}
        >
            {/* Progress track */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                    borderRadius: '3px',
                    pointerEvents: 'none',
                    transition: dragging ? 'none' : 'width 0.1s linear',
                }}
            />
            {/* Playhead thumb */}
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: `${progressPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 0 6px rgba(99, 102, 241, 0.8)',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
};

export default ScrubBar;
