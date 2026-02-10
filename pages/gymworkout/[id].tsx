// pages/gymworkout/[id].tsx
// BXKR — Gym Workout Viewer (List-style, set logging, GIF→Video media modal)
// Hydration-safe, GIF size 64px always, sets expanded by default with a single arrow toggle.
// FIX: Completion is now evaluated for the selected week (Mon–Sun) that the selected day belongs to.

import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import useSWR from "swr";
import Link from "next/link";
import useGymExerciseMedia, { GymRound as MediaRound } from "../../hooks/useGymExerciseMedia";
import BottomNav from "../../components/BottomNav";

const ACCENT = "#FF8A2A";
const GREEN = "#22c55e";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

// ---- Helpers ----
function fixGifUrl(u?: string) {
  if (!u) return u;
  if (u.startsWith("public/")) return "/" + u.replace(/^public\//, "");
  return u;
}
function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}
function startOfAlignedWeek(d: Date) {
  const day = d.getDay(); // 0=Sun,1=Mon...
  const diffToMon = (day + 6) % 7; // Mon=0
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}
function endOfAlignedWeek(d: Date) {
  const s = startOfAlignedWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

// ---- Types ----
type UISingleItem = {
  type: "Single";
  order: number;
  exercise_id: string;
  exercise_name?: string;
  sets?: number;
  reps?: string;
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

type UISupersetSubItem = {
  exercise_id: string;
  exercise_name?: string;
  reps?: string;
  weight_kg?: number | null;
};

type UISupersetItem = {
  type: "Superset";
  order: number;
  name?: string | null;
  items: UISupersetSubItem[];
  sets?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

type UIRound = {
  name: string;
  order: number;
  items: Array<UISingleItem | UISupersetItem>;
};

type GymWorkout = {
  workout_id: string;
  workout_name: string;
  focus?: string;
  notes?: string;
  warmup?: UIRound | null;
  main: UIRound;
  finisher?: UIRound | null;
};

type CompletionSet = {
  exercise_id: string;
  set: number;
  weight: number | null;
  reps: number | null;
};

type PreviousCompletion = {
  sets?: CompletionSet[];
  completedAt?: string;
};

type Completion = {
  id?: string;
  workout_id?: string;
  is_freestyle?: boolean;
  activity_type?: string | null;
  duration_minutes?: number | null;
  duration?: number | null;
  calories_burned?: number | null;
  weight_completed_with?: number | null;
  completed_date?: any;
  date_completed?: any;
};

// Build rounds for media hook
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
        ? { type: "Single" as const, exercise_id: (it as UISingleItem).exercise_id }
        : {
            type: "Superset" as const,
            items: (it as UISupersetItem).items.map((s) => ({ exercise_id: s.exercise_id })),
          }
    ),
  }));
}

/* ---------------- Media Modal ---------------- */
type MediaModalProps = {
  open: boolean;
  title?: string;
  gifUrl?: string;
  videoUrl?: string;
  onClose: () => void;
};

function MediaModal({ open, title, gifUrl, videoUrl, onClose }: MediaModalProps) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const slides = useMemo(() => {
    const s: Array<{ kind: "gif" | "video"; url: string }> = [];
    if (gifUrl) s.push({ kind: "gif", url: gifUrl });
    if (videoUrl) s.push({ kind: "video", url: videoUrl });
    return s;
  }, [gifUrl, videoUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(slides.length - 1, i + 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, slides.length]);

  useEffect(() => {
    if (!open) setIndex(0);
  }, [open]);

  if (!open) return null;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    if (dx < -40) setIndex((i) => Math.min(slides.length - 1, i + 1));
    if (dx > 40) setIndex((i) => Math.max(0, i - 1));
    touchStartX.current = null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Exercise media"}
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        zIndex: 1050,
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).dataset?.scrim === "1") onClose();
      }}
      data-scrim="1"
    >
      <div
        className="position-absolute top-50 start-50 translate-middle"
        style={{ width: "92vw", maxWidth: 680, touchAction: "pan-y" as any }}
      >
        <div className="futuristic-card p-2" onClick={(e) => e.stopPropagation()}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-semibold">{title}</div>
            <button
              aria-label="Close"
              className="btn btn-sm btn-outline-light"
              onClick={onClose}
              style={{ borderRadius: 999 }}
            >
              ✕
            </button>
          </div>

          <div
            className="position-relative"
            style={{
              borderRadius: 12,
              overflow: "hidden",
              background: "rgba(255,255,255,0.06)",
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {slides.length === 0 ? (
              <div className="p-5 text-center text-dim small">No media available</div>
            ) : slides[index].kind === "gif" ? (
              <img
                src={slides[index].url}
                alt={title}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            ) : (
              <div style={{ position: "relative", paddingTop: "56.25%" }}>
                <iframe
                  src={slides[index].url}
                  title={title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    border: 0,
                  }}
                />
              </div>
            )}
          </div>

          {/* Dots */}
          {slides.length > 1 && (
            <div className="d-flex justify-content-center gap-2 mt-2">
              {slides.map((_, i) => (
                <span
                  key={i}
                  onClick={() => setIndex(i)}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: i === index ? ACCENT : "rgba(255,255,255,0.25)",
                    display: "inline-block",
                    cursor: "pointer",
                    boxShadow: i === index ? `0 0 10px ${ACCENT}77` : undefined,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main Page ---------------- */
export default function GymWorkoutViewerPage() {
  const router = useRouter();
  const { id, date } = router.query;

  // Selected day context: from ?date=YYYY-MM-DD or default to today
  const selectedYMD = useMemo(() => {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return formatYMD(new Date());
  }, [date]);

  const selectedDate = useMemo(() => {
    // Safe parse as local date at 00:00
    return new Date(`${selectedYMD}T00:00:00`);
  }, [selectedYMD]);

  // Compute the calendar week range (Mon–Sun) that the selected day belongs to
  const weekStartKey = useMemo(() => formatYMD(startOfAlignedWeek(selectedDate)), [selectedDate]);
  const weekEndKey = useMemo(() => formatYMD(endOfAlignedWeek(selectedDate)), [selectedDate]);

  // API: workout details
  const workoutUrl = id && !Array.isArray(id) ? `/api/workouts/${id}` : null;
  const { data, error } = useSWR<GymWorkout>(workoutUrl, fetcher, { revalidateOnFocus: false });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [formSets, setFormSets] = useState<CompletionSet[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [previousSession, setPreviousSession] = useState<PreviousCompletion | null>(null);
  const [showPrev, setShowPrev] = useState(false);

  // Completion modal (Difficulty/Calories/etc.)
  const [completeOpen, setCompleteOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<string>("");
  const [calories, setCalories] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Media modal
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaTitle, setMediaTitle] = useState<string | undefined>();
  const [mediaGif, setMediaGif] = useState<string | undefined>();
  const [mediaVideo, setMediaVideo] = useState<string | undefined>();

  // Inputs: consistent widths
  const KG_INPUT_W = 88;
  const REPS_INPUT_W = 88;

  // Load previous session (for inline display only)
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

  // Inline previous values lookup map: key = `${exercise_id}|${set}`
  const prevByKey = useMemo(() => {
    const m: Record<string, { weight: number | null; reps: number | null }> = {};
    if (previousSession?.sets?.length) {
      for (const s of previousSession.sets) {
        m[`${s.exercise_id}|${s.set}`] = { weight: s.weight ?? null, reps: s.reps ?? null };
      }
    }
    return m;
  }, [previousSession]);

  // Media hook
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

  // Difficulty -> RPE mapping
  const difficultyToRPE = (d: string): number | null => {
    const v = d.toLowerCase();
    if (v === "easy") return 4;
    if (v === "medium") return 6;
    if (v === "hard") return 8;
    return null;
  };

  // ---------- WEEKLY COMPLETION (Mon–Sun of the selected day) ----------
  // Fetch completions for the whole week that contains `selectedYMD`
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

      const body: any = {
        workout_id: id,
        activity_type: "Strength training",
        sets: formSets,
      };

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

      // After saving, return to dashboard (it will reflect the correct week/day state)
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

      <main
        className="container py-3"
        style={{
          color: "#fff",
          paddingBottom: 90,
          ["--kgw" as any]: `88px`,
          ["--repsw" as any]: `88px`,
          touchAction: "pan-y" as any,
        }}
      >
        <div className="mb-3 d-flex justify-content-between align-items-center">
          <Link href="/" className="btn btn-outline-secondary">
            ← Back
          </Link>
          {data?.workout_name && (
            <div className="fw-bold text-truncate" style={{ maxWidth: 280 }}>
              {data.workout_name}
            </div>
          )}
          <div />
        </div>

        {/* Context note: which week we’re checking */}
        <div className="text-dim small mb-2">
          Week window: <span className="fw-semibold">{weekStartKey}</span> → <span className="fw-semibold">{weekEndKey}</span>
        </div>

        {error && <div className="alert alert-danger">Could not load this workout.</div>}
        {!data && !error && <div className="text-dim small">Loading workout…</div>}

        {data && (
          <>
            {/* Header */}
            <section
              className="futuristic-card p-3 mb-3"
              style={
                isCompleted
                  ? {
                      borderColor: GREEN,
                      boxShadow: `0 0 0 1px ${GREEN}55 inset, 0 0 16px ${GREEN}22`,
                    }
                  : undefined
              }
            >
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                <h2 className="m-0">{data.workout_name}</h2>
                <div className="d-flex align-items-center gap-2 ms-auto">
                  <span className="badge" style={{ background: ACCENT, color: "#0b0f14" }}>
                    Gym
                  </span>
                  {isCompleted && (
                    <span
                      className="badge"
                      style={{
                        border: `1px solid ${GREEN}AA`,
                        color: GREEN,
                        background: "transparent",
                      }}
                      title={`Completed sometime this week (${weekStartKey}–${weekEndKey})`}
                    >
                      Completed
                    </span>
                  )}
                </div>
              </div>
              {data.notes && <div className="mt-1 text-dim small">{data.notes}</div>}
            </section>

            {/* Previous Session (collapsible card) */}
            {previousSession && (
              <section className="futuristic-card p-3 mb-3">
                <div
                  className="d-flex justify-content-between align-items-center"
                  style={{ cursor: "pointer" }}
                  onClick={() => setShowPrev((s) => !s)}
                >
                  <h5 className="m-0">Previous Session</h5>
                  <i className={`fas fa-chevron-${showPrev ? "up" : "down"}`} />
                </div>

                {showPrev && previousSession.sets && (
                  <div className="mt-2 small">
                    {previousSession.sets.map((s, i) => (
                      <div key={i} className="mb-1">
                        <strong>{s.exercise_id}</strong> — Set {s.set}: {s.weight ?? "-"}kg × {s.reps ?? "-"} reps
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Rounds */}
            {data.warmup && (
              <RoundBlock
                round={data.warmup}
                media={mediaById}
                prevByKey={prevByKey}
                onUpdateSet={updateSet}
                onOpenMedia={openMedia}
                kgWidth={KG_INPUT_W}
                repsWidth={REPS_INPUT_W}
              />
            )}
            <RoundBlock
              round={data.main}
              media={mediaById}
              prevByKey={prevByKey}
              onUpdateSet={updateSet}
              onOpenMedia={openMedia}
              kgWidth={KG_INPUT_W}
              repsWidth={REPS_INPUT_W}
            />
            {data.finisher && (
              <RoundBlock
                round={data.finisher}
                media={mediaById}
                prevByKey={prevByKey}
                onUpdateSet={updateSet}
                onOpenMedia={openMedia}
                kgWidth={KG_INPUT_W}
                repsWidth={REPS_INPUT_W}
              />
            )}

            {/* Complete Workout */}
            <div className="d-grid mt-3">
              {isCompleted ? (
                <button
                  className="btn btn-outline-success"
                  style={{
                    borderRadius: 24,
                    borderColor: GREEN,
                    color: GREEN,
                    fontWeight: 700,
                    background: "transparent",
                  }}
                  disabled
                >
                  Completed
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                    border: "none",
                    borderRadius: 24,
                    fontWeight: 700,
                  }}
                  onClick={() => setCompleteOpen(true)}
                >
                  Complete Workout
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* Completion Modal: Difficulty + Calories (+ optional Duration/Notes) */}
      {completeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ background: "rgba(0,0,0,0.65)", zIndex: 1050 }}
          onClick={(e) => {
            if ((e.target as HTMLElement).dataset?.scrim === "1") setCompleteOpen(false);
          }}
          data-scrim="1"
        >
          <div className="position-absolute top-50 start-50 translate-middle" style={{ width: "92vw", maxWidth: 720 }}>
            <div className="futuristic-card p-3" onClick={(e) => e.stopPropagation()}>
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="m-0">Complete workout</h5>
                <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 999 }} onClick={() => setCompleteOpen(false)}>
                  ✕
                </button>
              </div>

              <div className="small text-dim mt-1">
                We’ll save your logged sets. Add <strong>Difficulty</strong> and <strong>Calories burnt</strong> for better tracking.
              </div>

              <div className="row g-2 mt-2">
                <div className="col-12 col-md-4">
                  <label className="form-label">Difficulty</label>
                  <select className="form-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    <option value="">—</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label">Calories burnt (kcal)</label>
                  <input
                    className="form-control"
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g., 420"
                    min={0}
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label">Duration (min)</label>
                  <input
                    className="form-control"
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g., 55"
                    min={0}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Notes (optional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything to note…"
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button className="btn btn-outline-light" style={{ borderRadius: 24 }} onClick={() => setCompleteOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{ borderRadius: 24, background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, border: "none" }}
                  onClick={submitCompletion}
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Save completion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <MediaModal open={mediaOpen} title={mediaTitle} gifUrl={mediaGif} videoUrl={mediaVideo} onClose={() => setMediaOpen(false)} />

      <BottomNav />
    </>
  );
}

/* ---------------- Round Block ---------------- */
function RoundBlock({
  round,
  media,
  prevByKey,
  onUpdateSet,
  onOpenMedia,
  kgWidth,
  repsWidth,
}: {
  round: UIRound;
  media: Record<string, { gif_url?: string; video_url?: string; exercise_name?: string }>;
  prevByKey: Record<string, { weight: number | null; reps: number | null }>;
  onUpdateSet: (exercise_id: string, set: number, patch: Partial<CompletionSet>) => void;
  onOpenMedia: (exercise_id: string) => void;
  kgWidth: number;
  repsWidth: number;
}) {
  const sorted = useMemo(() => [...(round.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [round.items]);

  return (
    <section className="futuristic-card p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h4 className="m-0">{round.name}</h4>
      </div>

      {sorted.length === 0 ? (
        <div className="text-dim small mt-2">No items.</div>
      ) : (
        sorted.map((it, idx) => (
          <div
            key={`${round.name}-${idx}`}
            className="p-2 mb-3"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
            }}
          >
            {it.type === "Single" ? (
              <SingleItemBlock
                item={it as UISingleItem}
                media={media[(it as UISingleItem).exercise_id]}
                prevByKey={prevByKey}
                onUpdateSet={onUpdateSet}
                onOpenMedia={onOpenMedia}
                kgWidth={kgWidth}
                repsWidth={repsWidth}
              />
            ) : (
              <SupersetBlock
                item={it as UISupersetItem}
                media={media}
                prevByKey={prevByKey}
                onUpdateSet={onUpdateSet}
                onOpenMedia={onOpenMedia}
                kgWidth={kgWidth}
                repsWidth={repsWidth}
              />
            )}
          </div>
        ))
      )}
    </section>
  );
}

/* ---------------- Single Item Block ---------------- */
function SingleItemBlock({
  item,
  media,
  prevByKey,
  onUpdateSet,
  onOpenMedia,
  kgWidth,
  repsWidth,
}: {
  item: UISingleItem;
  media?: { gif_url?: string; video_url?: string; exercise_name?: string };
  prevByKey: Record<string, { weight: number | null; reps: number | null }>;
  onUpdateSet: (exercise_id: string, set: number, patch: Partial<CompletionSet>) => void;
  onOpenMedia: (exercise_id: string) => void;
  kgWidth: number;
  repsWidth: number;
}) {
  const sets = Number.isFinite(item.sets) ? Number(item.sets) : 3;
  const rest = item.rest_s ?? null;

  const [expanded, setExpanded] = useState<boolean>(true);

  return (
    <div>
      {/* Header row */}
      <div className="d-flex align-items-center gap-2 gap-md-3 mb-2 flex-wrap">
        {/* Media thumb */}
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          style={{ borderRadius: 12, padding: 0, overflow: "hidden", flex: "0 0 auto" }}
          onClick={() => onOpenMedia(item.exercise_id)}
          aria-label={`Open media for ${media?.exercise_name || item.exercise_id}`}
        >
          {media?.gif_url ? (
            <img
              src={fixGifUrl(media.gif_url)}
              alt={media?.exercise_name || item.exercise_id}
              style={{ width: 64, height: 64, objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              className="d-flex align-items-center justify-content-center"
              style={{ width: 64, height: 64, background: "rgba(255,255,255,0.06)" }}
            >
              <i className="fas fa-play" />
            </div>
          )}
        </button>

        {/* Title + meta */}
        <div className="flex-fill" style={{ minWidth: 220 }}>
          <div className="fw-semibold text-truncate" style={{ lineHeight: 1.2 }}>
            {media?.exercise_name || item.exercise_id}
          </div>
          <div className="text-dim small">
            {sets} Sets{rest != null ? ` • Rest ${rest}s` : ""}{item.reps ? ` • ${item.reps}` : ""}
          </div>
          {item.notes && <div className="small text-dim mt-1">{item.notes}</div>}
        </div>

        {/* Toggle */}
        <button
          className="btn btn-sm"
          style={{
            borderRadius: 999,
            border: `1px solid ${ACCENT}88`,
            color: ACCENT,
            background: "transparent",
            fontWeight: 600,
          }}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`single-sets-${item.exercise_id}`}
          title={expanded ? "Collapse sets" : "Expand sets"}
        >
          <i className={`fas fa-chevron-${expanded ? "up" : "down"}`} />
        </button>
      </div>

      {/* Inputs grid */}
      {expanded && (
        <div id={`single-sets-${item.exercise_id}`} className="d-flex flex-column" style={{ gap: 8 }}>
          {Array.from({ length: sets }).map((_, i) => {
            const prev = prevByKey[`${item.exercise_id}|${i + 1}`];
            return (
              <div
                key={i}
                className="d-flex align-items-center flex-wrap"
                style={{
                  gap: 8,
                  background: "rgba(255,255,255,0.035)",
                  border: "1px dashed rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  padding: 8,
                }}
              >
                <div className="text-dim small" style={{ width: 52, textAlign: "right", flex: "0 0 auto" }}>
                  Set {i + 1}
                </div>
                <input
                  className="form-control"
                  type="number"
                  inputMode="decimal"
                  placeholder="kg"
                  onChange={(e) => onUpdateSet(item.exercise_id, i + 1, { weight: Number(e.target.value) || null })}
                  style={{ width: "var(--kgw)", fontSize: "0.9rem", flex: "0 0 auto" }}
                />
                <div className="d-flex align-items-center" style={{ gap: 6, flex: "0 0 auto" }}>
                  <input
                    className="form-control"
                    type="number"
                    inputMode="numeric"
                    placeholder="reps"
                    onChange={(e) => onUpdateSet(item.exercise_id, i + 1, { reps: Number(e.target.value) || null })}
                    style={{ width: "var(--repsw)", fontSize: "0.9rem" }}
                  />
                  <span className="small text-dim">reps</span>
                </div>

                {/* Prev inline */}
                <div className="small text-dim ms-auto" style={{ minWidth: 160 }}>
                  Prev: {(prev?.weight ?? "-")}kg × {(prev?.reps ?? "-")} reps
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Superset Block ---------------- */
function SupersetBlock({
  item,
  media,
  prevByKey,
  onUpdateSet,
  onOpenMedia,
  kgWidth,
  repsWidth,
}: {
  item: UISupersetItem;
  media: Record<string, { gif_url?: string; video_url?: string; exercise_name?: string }>;
  prevByKey: Record<string, { weight: number | null; reps: number | null }>;
  onUpdateSet: (exercise_id: string, set: number, patch: Partial<CompletionSet>) => void;
  onOpenMedia: (exercise_id: string) => void;
  kgWidth: number;
  repsWidth: number;
}) {
  const sets = Number.isFinite(item.sets) ? Number(item.sets) : 3;
  const rest = item.rest_s ?? null;

  const [expanded, setExpanded] = useState<boolean>(true);

  return (
    <div>
      {/* Superset header */}
      <div className="d-flex align-items-center justify-content-between mb-1 flex-wrap gap-2">
        <strong className="text-truncate">{(item.name || "").trim() || "Superset"}</strong>
        <div className="d-flex align-items-center gap-2">
          <span className="badge border" style={{ borderColor: ACCENT, color: ACCENT }}>
            {sets} sets
          </span>
          <button
            className="btn btn-sm"
            style={{
              borderRadius: 999,
              border: `1px solid ${ACCENT}88`,
              color: ACCENT,
              background: "transparent",
              fontWeight: 600,
            }}
            onClick={() => setExpanded((v) => (v ? false : true))}
            aria-expanded={expanded}
            aria-controls={`ss-sets-${(item.name || "").replace(/\s+/g, "-")}`}
            title={expanded ? "Collapse sets" : "Expand sets"}
          >
            <i className={`fas fa-chevron-${expanded ? "up" : "down"}`} />
          </button>
        </div>
      </div>

      <div className="text-dim small mb-2">
        {rest != null ? `Rest between sets: ${rest}s` : ""}
        {item.notes ? ` • ${item.notes}` : ""}
      </div>

      {/* All sets (expanded by default) */}
      {expanded && (
        <div id={`ss-sets-${(item.name || "").replace(/\s+/g, "-")}`}>
          {Array.from({ length: sets }).map((_, setIdx) => (
            <div
              key={setIdx}
              className="p-2 mb-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px dashed rgba(255,255,255,0.15)",
                borderRadius: 10,
              }}
            >
              <div className="fw-semibold mb-2">Set {setIdx + 1}</div>

              {item.items.map((sub, i) => {
                const m = media[sub.exercise_id] || {};
                const prev = prevByKey[`${sub.exercise_id}|${setIdx + 1}`];

                return (
                  <div key={i} className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                    {/* Media thumb */}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-light"
                      style={{ borderRadius: 12, padding: 0, overflow: "hidden", flex: "0 0 auto" }}
                      onClick={() => onOpenMedia(sub.exercise_id)}
                    >
                      {m.gif_url ? (
                        <img
                          src={fixGifUrl(m.gif_url)}
                          alt={m.exercise_name || sub.exercise_id}
                          style={{ width: 64, height: 64, objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div
                          className="d-flex align-items-center justify-content-center"
                          style={{ width: 64, height: 64, background: "rgba(255,255,255,0.06)" }}
                        >
                          <i className="fas fa-play" />
                        </div>
                      )}
                    </button>

                    {/* Name + prescribed reps + inputs aligned with Single layout */}
                    <div className="flex-fill" style={{ minWidth: 220 }}>
                      <div className="fw-semibold text-truncate" style={{ lineHeight: 1.2 }}>
                        {m.exercise_name || sub.exercise_id}
                      </div>
                      <div className="text-dim small">{sub.reps ? `• ${sub.reps} reps` : ""}</div>

                      <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                        <div className="text-dim small" style={{ width: 52, textAlign: "right", flex: "0 0 auto" }}>
                          &nbsp;
                        </div>

                        <input
                          className="form-control"
                          type="number"
                          inputMode="decimal"
                          placeholder="kg"
                          onChange={(e) => onUpdateSet(sub.exercise_id, setIdx + 1, { weight: Number(e.target.value) || null })}
                          style={{ width: "var(--kgw)", fontSize: "0.85rem", flex: "0 0 auto" }}
                        />

                        <div className="d-flex align-items-center" style={{ gap: 6, flex: "0 0 auto" }}>
                          <input
                            className="form-control"
                            type="number"
                            inputMode="numeric"
                            placeholder="reps"
                            onChange={(e) =>
                              onUpdateSet(sub.exercise_id, setIdx + 1, { reps: Number(e.target.value) || null })
                            }
                            style={{ width: "var(--repsw)", fontSize: "0.85rem" }}
                          />
                          <span className="small text-dim">reps</span>
                        </div>

                        {/* Prev inline */}
                        <div className="small text-dim ms-auto" style={{ minWidth: 160 }}>
                          Prev: {(prev?.weight ?? "-")}kg × {(prev?.reps ?? "-")} reps
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
