// File: pages/gymworkout/[id].tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import useSWR from "swr";
import useGymExerciseMedia, { GymRound as MediaRound } from "../../hooks/useGymExerciseMedia";
import BottomNav from "../../components/BottomNav";
import HeaderBar from "../../components/gymworkout/HeaderBar";
import MediaModal from "../../components/gymworkout/MediaModal";
import CompletionModal from "../../components/gymworkout/CompletionModal";
import RoundSection from "../../components/gymworkout/RoundSection";
import type {
  Completion,
  CompletionSet,
  GymWorkout,
  PreviousCompletion,
  UIRound,
} from "../../components/gymworkout/types";
import { fixGifUrl, formatYMD, startOfAlignedWeek, endOfAlignedWeek } from "../../components/gymworkout/utils";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function toMediaRounds(w: GymWorkout | undefined | null): MediaRound[] {
  if (!w) return [];
  const rounds: UIRound[] = [];
  if (w.warmup) rounds.push(w.warmup);
  if (w.main) rounds.push(w.main);
  if (w.finisher) rounds.push(w.finisher);

  return rounds.map((r, i) => ({
    name: r.name,
    order: i + 1,
    items: r.items.map((it) =>
      it.type === "Single"
        ? { type: "Single" as const, exercise_id: (it as any).exercise_id }
        : {
            type: "Superset" as const,
            items: (it as any).items.map((s: any) => ({ exercise_id: s.exercise_id })),
          }
    ),
  }));
}

function difficultyFromRPE(rpe: any): string {
  const n = Number(rpe);
  if (!Number.isFinite(n)) return "";
  if (n <= 4) return "Easy";
  if (n <= 7) return "Medium";
  return "Hard";
}

export default function GymWorkoutViewerPage() {
  const router = useRouter();
  const { id, date } = router.query;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const selectedYMD = useMemo(() => {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return formatYMD(new Date());
  }, [date]);

  const selectedDate = useMemo(() => new Date(`${selectedYMD}T00:00:00`), [selectedYMD]);
  const weekStartKey = useMemo(() => formatYMD(startOfAlignedWeek(selectedDate)), [selectedDate]);
  const weekEndKey = useMemo(() => formatYMD(endOfAlignedWeek(selectedDate)), [selectedDate]);

  const workoutUrl = id && !Array.isArray(id) ? `/api/workouts/${encodeURIComponent(String(id))}` : null;
  const { data, error } = useSWR<GymWorkout>(workoutUrl, fetcher, { revalidateOnFocus: false });

  const { data: strengthProfileResp } = useSWR(
    mounted ? "/api/strength/profile/get" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const trainingMaxes: Record<string, number> = strengthProfileResp?.profile?.training_maxes || {};
  const defaultRounding: number = strengthProfileResp?.profile?.rounding_increment_kg ?? 2.5;

  const [formSets, setFormSets] = useState<CompletionSet[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [previousSession, setPreviousSession] = useState<PreviousCompletion | null>(null);
  const [showPrev, setShowPrev] = useState(false);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<string>("");
  const [calories, setCalories] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaTitle, setMediaTitle] = useState<string | undefined>();
  const [mediaGif, setMediaGif] = useState<string | undefined>();
  const [mediaVideo, setMediaVideo] = useState<string | undefined>();

  // ✅ Edit mode: completion for THIS workout in THIS week
  const [editingCompletionId, setEditingCompletionId] = useState<string | null>(null);
  const hydratedForCompletionId = useRef<string | null>(null);

  // Load previous session (latest overall for this workout) — kept as-is
  useEffect(() => {
    if (!mounted || !id || Array.isArray(id)) return;

    fetch(`/api/completions/last?workout_id=${encodeURIComponent(String(id))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const last = json?.last || json;
        if (last?.sets) setPreviousSession({ sets: last.sets, completedAt: last.completed_date });
      })
      .catch(() => {});
  }, [mounted, id]);

  // ✅ Load completion for the current week window (prefer selected date)
  useEffect(() => {
    if (!mounted || !id || Array.isArray(id)) return;

    const url =
      `/api/completions/last?workout_id=${encodeURIComponent(String(id))}` +
      `&from=${encodeURIComponent(weekStartKey)}` +
      `&to=${encodeURIComponent(weekEndKey)}` +
      `&date=${encodeURIComponent(selectedYMD)}`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const last = json?.last || null;

        if (!last?.id) {
          setEditingCompletionId(null);
          hydratedForCompletionId.current = null;
          return;
        }

        const completionId = String(last.id);
        setEditingCompletionId(completionId);

        // Hydrate only once per completion id (do not overwrite user edits)
        if (hydratedForCompletionId.current === completionId) return;
        hydratedForCompletionId.current = completionId;

        const sets = Array.isArray(last.sets) ? (last.sets as any[]) : [];
        const mappedSets: CompletionSet[] = sets
          .map((s: any) => ({
            exercise_id: String(s?.exercise_id || "").trim(),
            set: Number(s?.set || 0),
            weight: typeof s?.weight === "number" ? s.weight : null,
            reps: typeof s?.reps === "number" ? s.reps : null,
            movement_key: typeof s?.movement_key === "string" ? s.movement_key : null,
          }))
          .filter((s) => s.exercise_id && Number.isFinite(s.set) && s.set > 0);

        setFormSets(mappedSets);

        // Summary fields
        setCalories(
          typeof last.calories_burned === "number" && Number.isFinite(last.calories_burned)
            ? String(last.calories_burned)
            : ""
        );

        setDuration(
          typeof last.duration_minutes === "number" && Number.isFinite(last.duration_minutes)
            ? String(last.duration_minutes)
            : ""
        );

        setNotes(typeof last.notes === "string" ? last.notes : "");
        setDifficulty(difficultyFromRPE(last.rpe));
      })
      .catch(() => {});
  }, [mounted, id, weekStartKey, weekEndKey, selectedYMD]);

  const prevByKey = useMemo(() => {
    const m: Record<string, { weight: number | null; reps: number | null }> = {};
    const sets = previousSession?.sets || [];

    for (const s of sets as any[]) {
      const exId = String(s?.exercise_id || "").trim();
      const setNum = Number(s?.set || 0);
      const weight = typeof s?.weight === "number" ? s.weight : null;
      const reps = typeof s?.reps === "number" ? s.reps : null;
      const movementKey = String(s?.movement_key || "").trim();

      if (!exId || !Number.isFinite(setNum) || setNum <= 0) continue;

      if (movementKey) {
        m[`${movementKey}|${setNum}`] = { weight, reps };
      }

      m[`${exId}|${setNum}`] = { weight, reps };
    }

    return m;
  }, [previousSession]);

  const volumeKg = useMemo(() => {
    let v = 0;
    for (const s of formSets) {
      if (typeof s.weight === "number" && typeof s.reps === "number") v += s.weight * s.reps;
    }
    return Math.round(v);
  }, [formSets]);

  const loggedSetCount = useMemo(() => {
    return formSets.filter((s) => s.weight != null || s.reps != null).length;
  }, [formSets]);

  const [tickKeys, setTickKeys] = useState<Record<string, boolean>>({});

  function toggleTick(exercise_id: string, setNum: number) {
    const k = `${exercise_id}|${setNum}`;
    setTickKeys((m) => ({ ...m, [k]: !m[k] }));
  }

  const mediaRounds = useMemo(() => toMediaRounds(data), [data]);
  const { mediaById } = useGymExerciseMedia(mediaRounds);

  function openMedia(exercise_id: string) {
    const row = mediaById[exercise_id] || {};
    setMediaTitle(row.exercise_name || exercise_id);
    setMediaGif(fixGifUrl(row.gif_url));
    setMediaVideo(row.video_url);
    setMediaOpen(true);
  }

  function updateSet(exercise_id: string, setNum: number, patch: Partial<CompletionSet>) {
    setFormSets((prev) => {
      const next = [...prev];

      const patchMovementKey =
        typeof (patch as any)?.movement_key === "string" ? String((patch as any).movement_key).trim() : "";
      const useMovementKey = Boolean(patchMovementKey);

      const idx = next.findIndex((s) => {
        if (s.set !== setNum) return false;
        if (useMovementKey) return String((s as any)?.movement_key || "") === patchMovementKey;
        return s.exercise_id === exercise_id;
      });

      if (idx >= 0) {
        next[idx] = { ...next[idx], ...patch } as any;
        if (useMovementKey) (next[idx] as any).movement_key = patchMovementKey;
      } else {
        next.push({
          exercise_id,
          set: setNum,
          reps: null,
          weight: null,
          ...(useMovementKey ? ({ movement_key: patchMovementKey } as any) : {}),
          ...patch,
        } as any);
      }

      return next;
    });
  }

  const difficultyToRPE = (d: string): number | null => {
    const v = d.toLowerCase();
    if (v === "easy") return 4;
    if (v === "medium") return 6;
    if (v === "hard") return 8;
    return null;
  };

  const weekCompletionsKey =
    mounted && id && !Array.isArray(id)
      ? `/api/completions?from=${encodeURIComponent(weekStartKey)}&to=${encodeURIComponent(weekEndKey)}`
      : null;

  const { data: weekCompletions } = useSWR<{
    results?: Completion[];
    items?: Completion[];
    completions?: Completion[];
    data?: Completion[];
  }>(weekCompletionsKey, fetcher, { revalidateOnFocus: false, dedupingInterval: 30_000 });

  // Keep your existing “completed this week” badge logic, but editingCompletionId is the real edit switch.
  const isCompleted = useMemo(() => {
    if (editingCompletionId) return true;
    if (!weekCompletions || !id || Array.isArray(id)) return false;

    const list: Completion[] =
      (weekCompletions.results as Completion[]) ||
      (weekCompletions.items as Completion[]) ||
      (weekCompletions.completions as Completion[]) ||
      (weekCompletions.data as Completion[]) ||
      [];

    const idStr = String(id);
    return list.some((c) => String(c.workout_id || "") === idStr);
  }, [weekCompletions, id, editingCompletionId]);

  async function submitCompletion() {
    if (!id || Array.isArray(id)) return;

    try {
      setSubmitting(true);

      const body: any = { workout_id: id, activity_type: "Strength training", sets: formSets };
      if (calories) body.calories_burned = Number(calories);
      if (duration) body.duration_minutes = Number(duration);

      const rpe = difficultyToRPE(difficulty);
      if (rpe != null) body.rpe = rpe;

      if (notes.trim()) body.notes = notes.trim();

      const isEditing = Boolean(editingCompletionId);
      const endpoint = isEditing ? `/api/completions/update` : `/api/completions/create`;

      if (isEditing) {
        body.completion_id = editingCompletionId;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save completion");

      router.push("/");
    } catch (e) {
      console.error(e);
      alert((e as any)?.message || "Failed to save completion");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  const isEditing = Boolean(editingCompletionId);
  const canSave = loggedSetCount > 0 && !submitting;

  return (
    <>
      <Head>
        <title>{data?.workout_name || "Gym Workout"}</title>
      </Head>

      <main
        className="container py-3"
        style={{
          color: "#fff",
          paddingBottom: 120,
          ["--kgw" as any]: `88px`,
          ["--repsw" as any]: `88px`,
        }}
      >
        <HeaderBar
          workoutName={data?.workout_name || "Gym Workout"}
          volumeKg={volumeKg}
          loggedSetCount={loggedSetCount}
          isCompleted={isCompleted}
          onFinish={() => setCompleteOpen(true)}
          weekStartKey={weekStartKey}
          weekEndKey={weekEndKey}
        />

        {error && <div className="alert alert-danger">Could not load this workout.</div>}
        {!data && !error && <div className="text-dim small">Loading workout…</div>}

        {data && (
          <>
            <section className="futuristic-card p-3 mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="fw-bold">{data.workout_name}</div>
                {isCompleted ? (
                  <span
                    className="badge"
                    style={{ color: "#22c55e", border: "1px solid #22c55eAA", background: "transparent" }}
                  >
                    Completed
                  </span>
                ) : null}
              </div>
              {data.notes ? <div className="text-dim small mt-1">{data.notes}</div> : null}
            </section>

            {previousSession ? (
              <section className="futuristic-card p-3 mb-3">
                <div
                  className="d-flex justify-content-between align-items-center"
                  style={{ cursor: "pointer" }}
                  onClick={() => setShowPrev((s) => !s)}
                >
                  <h5 className="m-0">Previous Session</h5>
                  <i className={`fas fa-chevron-${showPrev ? "up" : "down"}`} />
                </div>

                {showPrev && previousSession.sets ? (
                  <div className="mt-2 small">
                    {(previousSession.sets as any[]).map((s, i) => (
                      <div key={i} className="mb-1">
                        <strong>{s.exercise_id}</strong> — Set {s.set}: {s.weight ?? "-"}kg × {s.reps ?? "-"} reps
                        {s.movement_key ? <span className="text-dim"> • {s.movement_key}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {data.warmup ? (
              <RoundSection
                title="Warm up"
                round={data.warmup}
                media={mediaById}
                prevByKey={prevByKey}
                trainingMaxes={trainingMaxes}
                defaultRounding={defaultRounding}
                onUpdateSet={updateSet}
                onToggleTick={toggleTick}
                tickKeys={tickKeys}
                onOpenMedia={openMedia}
              />
            ) : null}

            <RoundSection
              title="Main set"
              round={data.main}
              media={mediaById}
              prevByKey={prevByKey}
              trainingMaxes={trainingMaxes}
              defaultRounding={defaultRounding}
              onUpdateSet={updateSet}
              onToggleTick={toggleTick}
              tickKeys={tickKeys}
              onOpenMedia={openMedia}
            />

            {data.finisher ? (
              <RoundSection
                title="Finisher"
                round={data.finisher}
                media={mediaById}
                prevByKey={prevByKey}
                trainingMaxes={trainingMaxes}
                defaultRounding={defaultRounding}
                onUpdateSet={updateSet}
                onToggleTick={toggleTick}
                tickKeys={tickKeys}
                onOpenMedia={openMedia}
              />
            ) : null}

            <section className="futuristic-card p-3 mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="fw-semibold">{isEditing ? "Edit workout" : "Complete workout"}</div>
                <div className="text-dim small">
                  {weekStartKey} → {weekEndKey}
                </div>
              </div>

              <div className="text-dim small mt-1">
                {loggedSetCount === 0
                  ? "Log at least one set before saving."
                  : isEditing
                  ? "Update your summary and save changes."
                  : "Add your summary and save."}
              </div>

              <button
                type="button"
                className="ia-btn ia-btn-primary w-100 mt-3"
                onClick={() => setCompleteOpen(true)}
                disabled={!canSave}
              >
                {submitting ? "Saving…" : isEditing ? "Save changes" : "Complete workout"}
              </button>
            </section>
          </>
        )}
      </main>

      <CompletionModal
        open={completeOpen}
        submitting={submitting}
        isEditing={isEditing}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        calories={calories}
        setCalories={setCalories}
        duration={duration}
        setDuration={setDuration}
        notes={notes}
        setNotes={setNotes}
        onClose={() => setCompleteOpen(false)}
        onSave={submitCompletion}
      />

      <MediaModal
        open={mediaOpen}
        title={mediaTitle}
        gifUrl={mediaGif}
        videoUrl={mediaVideo}
        onClose={() => setMediaOpen(false)}
      />

      <BottomNav />
    </>
  );
}
