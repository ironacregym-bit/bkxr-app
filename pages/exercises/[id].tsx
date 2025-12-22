
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
  exercise_name: string | null;
  type: string | null;
  equipment: string | null;
  video_url: string | null;
  met_value: number | null;
  description?: string | null;
};

function isHttpUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const trimmed = s.trim();
  if (!trimmed) return false;
  // Avoid calling startsWith on null/undefined; we’re already ensuring string here.
  const lower = trimmed.toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://");
}

export default function ExerciseDetailPage() {
  const router = useRouter();

  // During prerender/initial load, router.query isn't ready yet
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
  const safeRouteId = typeof id === "string" ? id : "";

  // Fetch all exercises once (no schema change, no new API)
  const { data, error, isLoading } = useSWR("/api/exercises?limit=1000", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  // Normalise and filter bad entries defensively
  const allItems: Exercise[] = useMemo(() => {
    const src = data?.exercises;
    if (!Array.isArray(src)) return [];
    // Filter out nullish entries and coerce fields safely
    return src
      .filter((x: any) => x && typeof x === "object")
      .map((x: any) => ({
        id: String(x.id ?? ""),
        exercise_name: (x.exercise_name ?? null) as string | null,
        type: (x.type ?? null) as string | null,
        equipment: (x.equipment ?? null) as string | null,
        video_url: (x.video_url ?? null) as string | null,
        met_value:
          typeof x.met_value === "number" ? x.met_value :
          x.met_value == null ? null :
          Number.isFinite(Number(x.met_value)) ? Number(x.met_value) : null,
        description: (x.description ?? null) as string | null,
      }));
  }, [data]);

  // Find exercise by id (doc id) then fallback to slug of name
  const exercise: Exercise | null = useMemo(() => {
    if (!safeRouteId) return null;

    // 1) Exact match by doc id
    const byId = allItems.find((e) => String(e.id) === safeRouteId);
    if (byId) return byId;

    // 2) Fallback match by encoded exercise_name
    const matchByName = allItems.find((e) => {
      const name = String(e?.exercise_name || "");
      if (!name) return false;
      const enc = encodeURIComponent(name);
      return enc.toLowerCase() === safeRouteId.toLowerCase();
    });

    return matchByName || null;
  }, [allItems, safeRouteId]);

  const name = String(exercise?.exercise_name || "Unnamed");
  const type = String(exercise?.type || "Uncategorised");
  const equipment = String(exercise?.equipment || "");
  const met = exercise?.met_value;
  const video = exercise?.video_url && typeof exercise.video_url === "string"
    ? exercise.video_url.trim()
    : "";

  const showVideo = isHttpUrl(video);

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
              className="btn btn-bxkr-outline"
              aria-label="Back to exercise library"
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
                <div className="fw-semibold h5 mb-1">{name}</div>
                <div className="small text-dim">
                  {type}{equipment ? ` • ${equipment}` : ""}{met != null ? ` • MET ${met}` : ""}
                </div>
                {exercise.description && (
                  <div className="mt-2">{exercise.description}</div>
                )}
              </div>

              <div className="text-end">
                {showVideo ? (
                  <a
                    href={video}
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
