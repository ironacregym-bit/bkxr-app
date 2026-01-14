
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const ACCENT = "#FF8A2A";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Exercise = {
  id?: string;
  exercise_id?: string;
  exercise_name?: string;
  name?: string;
  Name?: string;
  type?: string;
  Type?: string;
  // any other fields are allowed; we won’t rely on them
  [key: string]: unknown;
};

type Props = {
  /** Optional initial tab; defaults to "All" */
  initialType?: "All" | "Boxing" | "Kettlebell" | "Warm up" | "Mobility" | "Weights" | "Bodyweight";
  /** How many items to show in the preview list */
  limit?: number;
  /** Show "Browse" CTA button in the header */
  showBrowseButton?: boolean;
  /** Extra className for outer section */
  className?: string;
};

/**
 * Exercise Library (DailyTasks‑style list in a futuristic-card)
 * - Reads /api/exercises or /api/exercises?type=...
 * - Displays the exercise name using `exercise_name` as the primary field
 * - No schema or API changes; safe fallbacks
 */
export default function ExerciseLibrary({
  initialType = "All",
  limit = 6,
  showBrowseButton = true,
  className,
}: Props) {
  const TYPES = useMemo(
    () => ["All", "Boxing", "Kettlebell", "Warm up", "Mobility", "Weights", "Bodyweight"] as const,
    []
  );
  const [activeType, setActiveType] = useState<(typeof TYPES)[number]>(initialType);

  const url =
    activeType === "All"
      ? "/api/exercises"
      : `/api/exercises?type=${encodeURIComponent(activeType)}`;

  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const items: Exercise[] = Array.isArray(data?.results || data?.items || data?.exercises)
    ? (data.results || data.items || data.exercises)
    : [];

  return (
    <section className={`futuristic-card p-3 ${className ?? ""}`} style={{ marginTop: 4 }}>
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="m-0" style={{ fontWeight: 700 }}>
          Exercise Library
        </h6>
        {showBrowseButton && (
          <Link
            href="/exercises"
            className="btn btn-outline-light btn-sm"
            style={{ borderRadius: 24 }}
          >
            Browse
          </Link>
        )}
      </div>

      {/* Filter chips */}
      <div className="d-flex flex-wrap gap-2 mt-3" role="tablist" aria-label="Exercise filters">
        {TYPES.map((t) => (
          <button
            key={t}
            className="bxkr-chip"
            onClick={() => setActiveType(t)}
            style={{
              borderColor: activeType === t ? ACCENT : "rgba(255,255,255,0.12)",
              color: activeType === t ? ACCENT : "#e9eef6",
            }}
            aria-pressed={activeType === t}
            role="tab"
          >
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-3">
        {isLoading && <div className="text-muted">Loading exercises…</div>}
        {error && <div className="text-danger">Failed to load exercises.</div>}
        {!isLoading && !error && items.length === 0 && (
          <div className="text-muted">No exercises found for {activeType}.</div>
        )}

        {items.slice(0, Math.max(0, limit)).map((ex) => {
          // ID (route key) – keep your existing precedence; add exercise_name as last resort
          const exId = (ex.id ?? ex.exercise_id ?? ex.Name ?? ex.exercise_name) as string | undefined;

          // Display name – prefer exercise_name as requested
          const exName =
            (ex.exercise_name ?? ex.name ?? ex.Name ?? "Exercise") as string;

          // Secondary label – keep your Type fallback (no schema changes)
          const exType = (ex.type ?? ex.Type ?? "Uncategorised") as string;

          // If we cannot derive an ID, don’t render a broken link; show a disabled row instead
          if (!exId || typeof exId !== "string") {
            return (
              <div
                key={`${exName}-${exType}`}
                className="futuristic-card p-3 mb-2 d-flex align-items-center justify-content-between opacity-75"
                aria-disabled
              >
                <div>
                  <div className="fw-semibold">{exName}</div>
                  <div className="small text-dim">{exType}</div>
                </div>
                <i className="fas fa-ban text-dim" title="Missing ID" />
              </div>
            );
          }

          return (
            <Link
              key={exId}
              href={`/exercises/${encodeURIComponent(exId)}`}
              className="text-decoration-none"
              style={{ color: "inherit" }}
              aria-label={`Open ${exName}`}
            >
              <div className="futuristic-card p-3 mb-2 d-flex align-items-center justify-content-between">
                <div>
                  <div className="fw-semibold">{exName}</div>
                  <div className="small text-dim">{exType}</div>
                </div>
                <i className="fas fa-chevron-right text-dim" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
