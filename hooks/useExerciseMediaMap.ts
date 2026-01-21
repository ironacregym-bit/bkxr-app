
// hooks/useExerciseMediaMap.ts
"use client";

import useSWR from "swr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type ExerciseItemOut = {
  exercise_id?: string;
};
type RoundOut = {
  category: "Boxing" | "Kettlebell";
  items: ExerciseItemOut[];
};

export function collectExerciseIds(rounds: RoundOut[]) {
  const ids = new Set<string>();
  for (const r of rounds) {
    if (r.category !== "Kettlebell") continue;
    for (const it of r.items || []) {
      if (it.exercise_id) ids.add(it.exercise_id);
    }
  }
  return Array.from(ids);
}

export default function useExerciseMediaMap(rounds: RoundOut[]) {
  const ids = collectExerciseIds(rounds);
  const key = ids.length ? `/api/exercises/media?ids=${encodeURIComponent(ids.join(","))}` : null;
  const { data, error, isLoading } = useSWR<{ media: Record<string, { exercise_name: string; video_url: string }> }>(
    key,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const videoByExerciseId: Record<string, string | undefined> = {};
  if (data?.media) {
    for (const [id, row] of Object.entries(data.media)) {
      videoByExerciseId[id] = row.video_url || undefined;
    }
  }

  return { videoByExerciseId, error, isLoading, ids };
}
