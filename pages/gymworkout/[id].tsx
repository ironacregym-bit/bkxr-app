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
import type { Completion, CompletionSet, GymWorkout, PreviousCompletion, UIRound } from "../../components/gymworkout/types";
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
        : { type: "Superset" as const, items: (it as any).items.map((s: any) => ({ exercise_id: s.exercise_id })) }
    ),
  }));
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

  const workoutUrl = id && !Array.isArray(id) ? `/api/workouts/${id}` : null;
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

  useEffect(() => {
    if (!mounted || !id || Array.isArray(id)) return;
    fetch(`/api/completions/last?workout_id=${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const last = json?.last || json;
        if (last?.sets) setPreviousSession({ sets: last.sets, completedAt: last.completed_date });
      })
      .catch(() => {});
  }, [mounted, id]);

  const prevByKey = useMemo(() => {
    const m: Record<string, { weight: number | null; reps: number | null }> = {};
    if (previousSession?.sets?.length) {
      for (const s of previousSession.sets) {
        m[`${s.exercise_id}|${s.set}`] = { weight: s.weight ?? null, reps: s.reps ?? null };
      }
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
    setTickKeys((m) => ({ ...m, !m[k] }));
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
      const idx = next.findIndex((s) => s.exercise_id === exercise_id && s.set === setNum);
      if (idx >= 0) next[idx] = { ...next[idx], ...patch };
      else next.push({ exercise_id, set: setNum, reps: null, weight: null, ...patch });
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

  const isCompleted = useMemo(() => {
    if (!weekCompletions || !id || Array.isArray(id)) return false;
    const list: Completion[] =
      (weekCompletions.results as Completion[]) ||
      (weekCompletions.items as Completion[]) ||
      (weekCompletions.completions as Completion[]) ||
      (weekCompletions.data as Completion[]) ||
      [];
    const idStr = String(id);
    return list.some((c) => String(c.workout_id || "") === idStr);
  }, [weekCompletions, id]);

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

      const res = await fetch(`/api/completions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to submit completion");
      router.push("/");
    } catch (e) {
      console.error(e);
      alert((e as any)?.message || "Failed to submit completion");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  return (
    <>
      <Head>
        <title>{data?.workout_name || "Gym Workout"}</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90, ["--kgw" as any]: `88px`, ["--repsw" as any]: `88px` }}>
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
                {isCompleted ? <span className="badge" style={{ color: "#22c55e", border: "1px solid #22c55eAA", background: "transparent" }}>Completed</span> : null}
              </div>
              {data.notes ? <div className="text-dim small mt-1">{data.notes}</div> : null}
            </section>

            {previousSession ? (
              <section className="futuristic-card p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowPrev((s) => !s)}>
                  <h5 className="m-0">Previous Session</h5>
                  <i className={`fas fa-chevron-${showPrev ? "up" : "down"}`} />
                </div>
                {showPrev && previousSession.sets ? (
                  <div className="mt-2 small">
                    {previousSession.sets.map((s, i) => (
                      <div key={i} className="mb-1">
                        <strong>{s.exercise_id}</strong> — Set {s.set}: {s.weight ?? "-"}kg × {s.reps ?? "-"} reps
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
          </>
        )}
      </main>

      <CompletionModal
        open={completeOpen}
        submitting={submitting}
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

      <MediaModal open={mediaOpen} title={mediaTitle} gifUrl={mediaGif} videoUrl={mediaVideo} onClose={() => setMediaOpen(false)} />

      <BottomNav />
    </>
  );
}
