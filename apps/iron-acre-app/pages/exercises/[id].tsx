// pages/exercises/[id].tsx

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
  const lower = trimmed.toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://");
}

export default function ExerciseDetailPage() {
  const router = useRouter();

  // Router not ready yet (client only)
  if (!router.isReady) {
    return (
      <>
        <main
          className="container py-3"
          style={{ paddingBottom: "90px", color: "#fff" }}
        >
          <div className="bxkr-card p-3 mb-3">Loading…</div>
        </main>
        <BottomNav />
      </>
    );
  }

  const { id } = router.query as { id?: string };
  const safeRouteId = typeof id === "string" ? id : "";

  const { data, error, isLoading } = useSWR(
    "/api/exercises?limit=1000",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const allItems: Exercise[] = useMemo(() => {
    const src = data?.exercises;
    if (!Array.isArray(src)) return [];

    return src
      .filter((x: any) => x && typeof x === "object")
      .map((x: any) => ({
        id: String(x.id ?? ""),
        exercise_name: x.exercise_name ?? null,
        type: x.type ?? null,
        equipment: x.equipment ?? null,
        video_url: x.video_url ?? null,
        met_value:
          typeof x.met_value === "number"
            ? x.met_value
            : Number.isFinite(Number(x.met_value))
            ? Number(x.met_value)
            : null,
        description: x.description ?? null,
      }));
  }, [data]);

  const exercise: Exercise | null = useMemo(() => {
    if (!safeRouteId) return null;

    // Match by ID
    const byId = allItems.find((e) => e.id === safeRouteId);
    if (byId) return byId;

    // Fallback: encoded name
    return (
      allItems.find((e) => {
        const name = e.exercise_name;
        if (!name) return false;
        return (
          encodeURIComponent(name).toLowerCase() ===
          safeRouteId.toLowerCase()
        );
      }) || null
    );
  }, [allItems, safeRouteId]);

  const name = exercise?.exercise_name || "Unnamed";
  const type = exercise?.type || "Uncategorised";
  const equipment = exercise?.equipment || "";
  const met = exercise?.met_value;
  const video = exercise?.video_url?.trim() || "";
  const showVideo = isHttpUrl(video);

  return (
    <>
      <main
        className="container py-3"
        style={{ paddingBottom: "90px", color: "#fff" }}
      >
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>
              Exercise
            </h1>
            <small className="text-dim">
              Details • Video • Equipment • MET
            </small>
          </div>
          <Link
            href="/exercises"
            className="btn btn-bxkr-outline"
            aria-label="Back to exercise library"
          >
            Back
          </Link>
        </div>

        {isLoading && (
          <div className="bxkr-card p-3 mb-3">Loading…</div>
        )}
        {error && (
          <div className="bxkr-card p-3 mb-3 text-danger">
            Failed to load exercise.
          </div>
        )}
        {!isLoading && !error && !exercise && (
          <div className="bxkr-card p-3 mb-3 text-dim">
            Exercise not found.
          </div>
        )}

        {exercise && (
          <div className="bxkr-card p-3">
            <div className="d-flex align-items-start justify-content-between">
              <div className="me-3">
                <div className="fw-semibold h5 mb-1">{name}</div>
                <div className="small text-dim">
                  {type}
                  {equipment && ` • ${equipment}`}
                  {met != null && ` • MET ${met}`}
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
                  >
                    <i className="fas fa-play-circle me-2" />
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

/**
 * 🔒 Force server-side rendering
 * Prevents Next from prerendering this dynamic route at build time
 */
export async function getServerSideProps() {
  return { props: {} };
}