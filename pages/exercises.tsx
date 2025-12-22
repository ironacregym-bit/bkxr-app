
"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// Matches your API response
type Exercise = {
  id: string;
  exercise_name: string;
  type: string;
  equipment: string;
  video_url: string;
  met_value: number | null;
};

const ACCENT = "#FF8A2A";

export default function ExercisesPage() {
  // Filters you requested
  const TYPES = ["All", "Boxing", "Kettlebell", "Warm up", "Mobility", "Weights", "Bodyweight"] as const;
  const [activeType, setActiveType] = useState<(typeof TYPES)[number]>("All");
  const [query, setQuery] = useState("");

  // Fetch once (large limit, then filter client-side)
  const { data, error, isLoading } = useSWR("/api/exercises?limit=1000", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const allItems: Exercise[] = useMemo(() => {
    const src = data?.exercises;
    return Array.isArray(src) ? src : [];
  }, [data]);

  // Client-side filtering by type + query
  const items: Exercise[] = useMemo(() => {
    const byType =
      activeType === "All"
        ? allItems
        : allItems.filter((e) => (e.type || "").toLowerCase() === activeType.toLowerCase());

    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return byType;

    return byType.filter((e) => {
      const name = (e.exercise_name || "").toLowerCase();
      const t = (e.type || "").toLowerCase();
      const eq = (e.equipment || "").toLowerCase();
      return name.includes(q) || t.includes(q) || eq.includes(q);
    });
  }, [allItems, activeType, query]);

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>Exercise Library</h1>
            <small className="text-dim">Boxing · Kettlebell · Warm up · Mobility · Weights · Bodyweight</small>
          </div>
          <div className="d-flex gap-2">
            <Link
              href="/train"
              className="btn btn-bxkr-outline btn-sm"
              aria-label="Back to Train"
            >
              Back to Train
            </Link>
          </div>
        </div>

        {/* Filters + Search */}
        <div className="bxkr-card p-3 mb-3">
          {/* Type chips */}
          <div className="d-flex flex-wrap gap-2 mb-2">
            {TYPES.map((t) => (
              <button
                key={t}
                className="bxkr-chip"
                onClick={() => setActiveType(t)}
                aria-pressed={activeType === t}
                style={{
                  borderColor: activeType === t ? ACCENT : "rgba(255,255,255,0.12)",
                  color: activeType === t ? ACCENT : "#e9eef6",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="d-flex gap-2">
            <input
              className="form-control"
              placeholder="Search exercises…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search exercises by name, type or equipment"
            />
            <button
              className="btn btn-bxkr-outline"
              onClick={() => setQuery("")}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Results */}
        {isLoading && <div className="bxkr-card p-3 mb-3">Loading…</div>}
        {error && <div className="bxkr-card p-3 mb-3 text-danger">Failed to load exercises.</div>}
        {!isLoading && !error && items.length === 0 && (
          <div className="bxkr-card p-3 mb-3 text-dim">No exercises found.</div>
        )}

        <div className="row g-3">
          {items.map((ex) => {
            const id = ex.id;
            const name = ex.exercise_name || "Unnamed";
            const type = ex.type || "Uncategorised";
            const equipment = ex.equipment || "";
            const met = ex.met_value;
            const video = ex.video_url || "";

            return (
              <div className="col-12" key={id}>
                <div className="bxkr-card p-3 d-flex align-items-center justify-content-between">
                  <div className="me-2">
                    <div className="fw-semibold">{name}</div>
                    <div className="small text-dim">
                      {type}{equipment ? ` • ${equipment}` : ""}{met ? ` • MET ${met}` : ""}
                    </div>
                    {video && (
                      <div className="small mt-1">
                        <a
                          href={video}
                          className="text-decoration-none"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <i className="fas fa-play-circle me-1" aria-hidden="true" />
                          Watch video
                        </a>
                      </div>
                    )}
                  </div>

                  {/* If you have a detail page /exercises/[id], keep this.
                      Otherwise you can remove it or point to the video. */}
                  <Link
                    href={`/exercises/${encodeURIComponent(String(id))}`}
                    className="btn btn-sm"
                    style={{
                      borderRadius: 24,
                      color: "#0b0f14",
                      background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                      boxShadow: `0 0 12px ${ACCENT}66`,
                    }}
                    aria-label={`View ${name}`}
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <BottomNav />
    </>
  );
}
