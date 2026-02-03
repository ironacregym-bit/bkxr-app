"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type KBStyle = "EMOM" | "AMRAP" | "LADDER";
export type KBRoundResult = {
  roundIndex: number;       // 0-based within KB rounds (UI index), map externally to 6..10 if needed
  name: string;
  style: KBStyle | undefined;
  completedRounds?: number; // AMRAP/LADDER
  totalReps?: number;       // EMOM sum convenience
  emom?: { minuteReps: [number, number, number] }; // EMOM only
  notes?: string | null;
};

export type KettlebellTrackingState = {
  workoutId: string;
  userEmail: string;
  rounds: KBRoundResult[]; // length = kbRoundsMeta.length
};

export type KbRoundMeta = {
  roundId: string;
  name: string;
  order: number;
  style?: KBStyle;
};

export type KbTrackingController = {
  state: KettlebellTrackingState;
  setRounds: (kbIdx: number, rounds: number) => void;
  incRounds: (kbIdx: number, delta: number) => void;
  setEmomMinute: (kbIdx: number, minuteIndex: number, value: number) => void;
  incEmomMinute: (kbIdx: number, minuteIndex: number, delta: number) => void;
  reset: () => void;
  getResultsForApi: () => Array<{
    roundIndex: number;
    name: string;
    style: KBStyle | undefined;
    completedRounds?: number;
    emom?: { minuteReps: [number, number, number] };
    totalReps?: number;
    notes?: string | null;
  }>;
};

function safeNumber(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

const DEBOUNCE_MS = 250;

export function useKbTracking(
  workoutId: string,
  userEmail: string,
  kbRoundsMeta: KbRoundMeta[]
): KbTrackingController {
  const storageKey = useMemo(
    () => (workoutId && userEmail ? `kbTrack::${workoutId}::${userEmail.toLowerCase()}` : ""),
    [workoutId, userEmail]
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Build default rounds based on meta
  const defaults: KettlebellTrackingState = useMemo(() => {
    const rounds: KBRoundResult[] = kbRoundsMeta.map((m, i) => {
      if (m.style === "EMOM") {
        return {
          roundIndex: i,
          name: m.name || `Kettlebell ${i + 1}`,
          style: m.style,
          emom: { minuteReps: [0, 0, 0] },
          totalReps: 0,
          notes: null,
        };
      }
      // AMRAP/LADDER → rounds
      return {
        roundIndex: i,
        name: m.name || `Kettlebell ${i + 1}`,
        style: m.style,
        completedRounds: 0,
        notes: null,
      };
    });
    return { workoutId, userEmail, rounds };
  }, [workoutId, userEmail, kbRoundsMeta]);

  const [state, setState] = useState<KettlebellTrackingState>(defaults);

  // Load from localStorage once mounted
  useEffect(() => {
    if (!mounted || !storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Soft-merge to align with current meta length/styles
        if (parsed && Array.isArray(parsed.rounds)) {
          const merged: KBRoundResult[] = defaults.rounds.map((d, i) => {
            const existing: KBRoundResult | undefined = parsed.rounds[i];
            if (!existing) return d;
            if (d.style === "EMOM") {
              const a = existing.emom?.minuteReps || [0, 0, 0];
              const minuteReps: [number, number, number] = [
                safeNumber(a[0], 0),
                safeNumber(a[1], 0),
                safeNumber(a[2], 0),
              ];
              const total = minuteReps[0] + minuteReps[1] + minuteReps[2];
              return { ...d, emom: { minuteReps }, totalReps: total, notes: existing.notes ?? null };
            }
            return {
              ...d,
              completedRounds: safeNumber(existing.completedRounds, 0),
              notes: existing.notes ?? null,
            };
          });
          setState({ ...defaults, rounds: merged });
          return;
        }
      }
    } catch {
      /* ignore */
    }
    // fallback to defaults
    setState(defaults);
  }, [mounted, storageKey, defaults]);

  // Debounced save
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = (next: KettlebellTrackingState) => {
    if (!mounted || !storageKey) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }, DEBOUNCE_MS);
  };

  // Mutators
  const setRounds = (kbIdx: number, rounds: number) => {
    setState((prev) => {
      const next = { ...prev, rounds: prev.rounds.slice() };
      const row = { ...(next.rounds[kbIdx] || {}) };
      row.completedRounds = Math.max(0, Math.floor(safeNumber(rounds, 0)));
      next.rounds[kbIdx] = row as KBRoundResult;
      queueSave(next);
      return next;
    });
  };

  const incRounds = (kbIdx: number, delta: number) => {
    setState((prev) => {
      const next = { ...prev, rounds: prev.rounds.slice() };
      const row = { ...(next.rounds[kbIdx] || {}) };
      const cur = safeNumber(row.completedRounds, 0);
      row.completedRounds = Math.max(0, cur + delta);
      next.rounds[kbIdx] = row as KBRoundResult;
      queueSave(next);
      return next;
    });
  };

  const setEmomMinute = (kbIdx: number, minuteIndex: number, value: number) => {
    setState((prev) => {
      const next = { ...prev, rounds: prev.rounds.slice() };
      const row = { ...(next.rounds[kbIdx] || {}) };
      const em = row.emom?.minuteReps ? [...row.emom.minuteReps] as [number, number, number] : [0, 0, 0];
      if (minuteIndex >= 0 && minuteIndex <= 2) em[minuteIndex] = Math.max(0, Math.floor(safeNumber(value, 0)));
      const total = em[0] + em[1] + em[2];
      next.rounds[kbIdx] = { ...(row as any), emom: { minuteReps: em }, totalReps: total };
      queueSave(next);
      return next;
    });
  };

  const incEmomMinute = (kbIdx: number, minuteIndex: number, delta: number) => {
    setState((prev) => {
      const next = { ...prev, rounds: prev.rounds.slice() };
      const row = { ...(next.rounds[kbIdx] || {}) };
      const em = row.emom?.minuteReps ? [...row.emom.minuteReps] as [number, number, number] : [0, 0, 0];
      if (minuteIndex >= 0 && minuteIndex <= 2) {
        const cur = safeNumber(em[minuteIndex], 0);
        em[minuteIndex] = Math.max(0, cur + delta);
      }
      const total = em[0] + em[1] + em[2];
      next.rounds[kbIdx] = { ...(row as any), emom: { minuteReps: em }, totalReps: total };
      queueSave(next);
      return next;
    });
  };

  const reset = () => {
    setState(defaults);
    if (mounted && storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  };

  const getResultsForApi = () =>
    state.rounds.map((r) => ({
      roundIndex: r.roundIndex,
      name: r.name,
      style: r.style,
      completedRounds: r.completedRounds,
      emom: r.emom ? { minuteReps: r.emom.minuteReps } : undefined,
      totalReps: r.totalReps,
      notes: r.notes ?? null,
    }));

  return { state, setRounds, incRounds, setEmomMinute, incEmomMinute, reset, getResultsForApi };
}
