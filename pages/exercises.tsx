
"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// Types align with your mixed sources (Sheets + Firestore API)
type Exercise = {
  id?: string;
  exercise_id?: string;
  ExerciseID?: string;
  name?: string;
  Name?: string;
  type?: string;
  Type?: string;
  equipment?: string;
  Equipment?: string;
  video_url?: string;
  VideoURL?: string;
  met_value?: number;
  MET?: number;
  description?: string;
};

const ACCENT = "#FF8A2A";

export default function ExercisesPage() {
  const TYPES = ["All", "Boxing", "Kettlebell", "Warm up", "Mobility", "Weights", "Bodyweight"] as const;
  const [activeType, setActiveType] = useState<(typeof TYPES)[number]>("All");
  const [query, setQuery] = useState("");

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (activeType !== "All") params.set("type", activeType);
    if (query.trim().length > 1) params.set("query", query.trim());
    const qs = params.toString();
    return qs ? `/api/exercises?${qs}` : "/api/exercises";
  }, [activeType, query]);

  const { data, error, isLoading } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const items: Exercise[] = useMemo(() => {
    const src = data?.results || data?.items || data?.exercises || data;
    const arr = Array.isArray(src) ? src : [];
    return arr;
  }, [data]);

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
              className="btn btn-sm"
              style={{
                borderRadius: 24,
                color: "#0b0f14",
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                boxShadow: `0 0 12px ${ACCENT}66`,
              }}
            >
              Back to Train
            </Link>
          </div>
        </div>

        {/* Filters + Search */}
        <div className="bxkr-card p-3 mb-3">
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
          <div className="d-flex gap-2">
            <input
              className="form-control"
              placeholder="Search exercises…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="btn btn-bxkr-outline"
              onClick={() => {
                setQuery("");
              }}
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
            const id =
              ex.id ?? ex.exercise_id ?? ex.ExerciseID ?? ex.Name ?? ex.name ?? "";
            const name = ex.name ?? ex.Name ?? "Unnamed";
            const type = ex.type ?? ex.Type ?? "Uncategorised";
            const equipment = ex.equipment ?? ex.Equipment ?? "";
            const met = ex.met_value ?? ex.MET ?? null;
            const video = ex.video_url ?? ex.VideoURL ?? "";

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
