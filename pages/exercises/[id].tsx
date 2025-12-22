
// pages/exercises/[id].tsx
"use client";

import { useMemo } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import Link from "next/link";
import BottomNav from "../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

type Exercise = {
  id: string;
  exercise_name: string;
  type: string;
  equipment: string;
  video_url: string;
  met_value: number | null;
  description?: string | null;
};

export default function ExerciseDetailPage() {
  const router = useRouter();

  // ✅ Guard: during prerender router is not ready; avoid reading query/id
  if (!router.isReady) {
    return (
      <>
        <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
          <div className="bxkr-card p-3 mb-3">Loading…</div>
        </main>
        <BottomNav />
      </>
    );
  }

  const { id } = router.query as { id?: string };

  // Fetch all then find by id (no schema change, no new API)
  const { data, error, isLoading } = useSWR("/api/exercises?limit=1000", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const allItems: Exercise[] = useMemo(() => {
    const src = data?.exercises;
    return Array.isArray(src) ? src : [];
  }, [data]);

  const exercise: Exercise | null = useMemo(() => {
    // ✅ Guard id strictly
    if (!id || typeof id !== "string") return null;
    const safeId = String(id);

    // Try match by Firestore doc id first
    const byId = allItems.find((e) => String(e.id) === safeId);
    if (byId) return byId;

    // Fallback: match by exercise_name (slug-like, but we compare exact encodeURIComponent)
    // ✅ Guard strings to avoid null/undefined methods
    const byName = allItems.find((e) => {
      const name = e?.exercise_name ?? "";
      const enc = encodeURIComponent(name);
      return enc.toLowerCase() === safeId.toLowerCase();
    });

    return byName || null;
  }, [allItems, id]);

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>Exercise</h1>
            <small className="text-dim">Details • Video • Equipment • MET</small>
          </div>
          <div className="d-flex gap-2">
            <Link
              href="/exercises"
              className="btn btn-bxkr-outline btn-sm"
              style={{ borderRadius: 24 }}
            >
              Back
            </Link>
          </div>
        </div>

        {/* Loading / Error / Not found */}
        {isLoading && <div className="bxkr-card p-3 mb-3">Loading…</div>}
        {error && <div className="bxkr-card p-3 mb-3 text-danger">Failed to load exercise.</div>}
        {!isLoading && !error && !exercise && (
          <div className="bxkr-card p-3 mb-3 text-dim">Exercise not found.</div>
        )}

        {/* Exercise Detail */}
        {exercise && (
          <div className="bxkr-card p-3">
            <div className="d-flex align-items-start justify-content-between">
              <div className="me-3">
                <div className="fw-semibold h5 mb-1">{exercise.exercise_name || "Unnamed"}</div>
                <div className="small text-dim">
                  {(exercise.type || "Uncategorised")}{" "}
                  {exercise.equipment ? `• ${exercise.equipment}` : ""}{" "}
                  {exercise.met_value != null ? `• MET ${exercise.met_value}` : ""}
                </div>
                {exercise.description && (
                  <div className="mt-2">{exercise.description}</div>
                )}
              </div>

              <div className="text-end">
                {exercise.video_url ? (
                  <a
                    href={exercise.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm"
                    style={{
                      borderRadius: 24,
                      color: "#0b0f14",
                      background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                      boxShadow: `0 0 12px ${ACCENT}66`,
                    }}
                    aria-label="Watch exercise video"
                  >
                    <i className="fas fa-play-circle me-2" aria-hidden="true" />
                    Watch video
                  </a>
                ) : (
                  <span className="bxkr-chip">No video</span>
                )}
              </div>
            </div>
          </div>
        )}
           </main>

      <BottomNav />
    </>
  );
}
