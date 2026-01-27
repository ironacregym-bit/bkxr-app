/** /hooks/useGymExerciseMedia.ts */
"use client";

import useSWR from "swr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Types that match gym rounds */
export type GymSingleItem = {
  type: "Single";
  exercise_id: string;
};

export type GymSupersetItem = {
  type: "Superset";
  items: { exercise_id: string }[];
};

export type GymRound = {
  name: string;
  order: number;
  items: Array<GymSingleItem | GymSupersetItem>;
};

/** Extract all exercise_ids from Single + Superset */
export function collectGymExerciseIds(rounds: GymRound[] | undefined | null) {
  const ids = new Set<string>();
  if (!rounds) return [];

  for (const r of rounds) {
    if (!r?.items) continue;

    for (const it of r.items) {
      if (it.type === "Single") {
        if (it.exercise_id) ids.add(it.exercise_id);
      } else if (it.type === "Superset") {
        for (const s of it.items || []) {
          if (s.exercise_id) ids.add(s.exercise_id);
        }
      }
    }
  }
  return Array.from(ids);
}

/** Main hook */
export default function useGymExerciseMedia(rounds: GymRound[] | undefined | null) {
  const ids = collectGymExerciseIds(rounds);

  const key =
    ids.length > 0
      ? `/api/exercises/media?ids=${encodeURIComponent(ids.join(","))}`
      : null;

  const { data, error, isLoading } = useSWR<
    { media: Record<string, { exercise_name: string; video_url?: string; gif_url?: string }> }
  >(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  /** Map by exercise_id */
  const mediaById: Record<
    string,
    { exercise_name?: string; gif_url?: string; video_url?: string }
  > = {};

  if (data?.media) {
    for (const [id, rec] of Object.entries(data.media)) {
      mediaById[id] = {
        exercise_name: rec.exercise_name,
        gif_url: rec.gif_url,
        video_url: rec.video_url,
      };
    }
  }

  return { mediaById, ids, isLoading, error };
}
