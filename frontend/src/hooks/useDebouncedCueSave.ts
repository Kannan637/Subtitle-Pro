// src/hooks/useDebouncedCueSave.ts
// Provides instant local state update (via Zustand) and debounced API save.
// Typing in the caption editor immediately reflects in the preview (60fps), 
// but only saves to the backend after the user stops typing for 800ms.

import { useMemo, useCallback } from 'react';
import { subtitlesApi } from '@/lib/api';
import { useTimeline } from '@/store/timelineStore';

// Minimal debounce — avoids lodash dependency
function makeDebounce<T extends (...args: any[]) => any>(fn: T, wait: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { fn(...args); }, wait);
  };

  debounced.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };

  return debounced;
}

export function useDebouncedCueSave() {
  const updateCue = useTimeline((s) => s.updateCue);

  // Create debounced saver once (memo prevents re-creation on every render)
  const debouncedSave = useMemo(
    () =>
      makeDebounce(
        async (cueId: string, patch: { text?: string; start_ms?: number; end_ms?: number }) => {
          try {
            await subtitlesApi.updateCue(cueId, patch);
          } catch (err) {
            console.error('[useDebouncedCueSave] API save failed:', err);
          }
        },
        800,
      ),
    [],
  );

  /**
   * Call this on every keystroke / cue edit.
   * - Updates Zustand store immediately (instant visual feedback)
   * - Debounces the actual API call to 800ms
   */
  const saveCue = useCallback(
    (cueId: string, patch: { text?: string; start_ms?: number; end_ms?: number }) => {
      updateCue(cueId, patch);     // instant: Zustand
      debouncedSave(cueId, patch); // delayed: API save
    },
    [updateCue, debouncedSave],
  );

  return { saveCue, cancelSave: debouncedSave.cancel };
}
