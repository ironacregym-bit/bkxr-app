// File: pages/admin/workouts/gym-create.tsx

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../../../components/BottomNav";
import GymCreateWorkout from "../../../components/gym-create/GymCreateWorkout";
import type {
  AdminWorkoutFetch as CanonicalAdminWorkoutFetch,
} from "../../../components/gym-create/GymCreateWorkout.constants";


type StrengthExercisesResp = {
  ok?: boolean;
  names?: string[];
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function normaliseEditId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function normaliseExercisesPayload(raw: any): ExerciseRow[] {
  const arr =
    (Array.isArray(raw?.exercises) && raw.exercises) ||
    (Array.isArray(raw?.items) && raw.items) ||
    (Array.isArray(raw?.results) && raw.results) ||
    (Array.isArray(raw?.data) && raw.data) ||
    [];

  const mapped: ExerciseRow[] = arr
    .map((x: any) => {
      const id = String(x?.id || x?._id || x?.exercise_id || x?.slug || x?.name || "").trim();
      const exercise_name = String(x?.exercise_name || x?.name || x?.title || "").trim();
      const type = x?.type ? String(x.type) : undefined;
      if (!id || !exercise_name) return null;
      return { id, exercise_name, type };
    })
    .filter(Boolean) as ExerciseRow[];

  const seen = new Set<string>();
  const deduped: ExerciseRow[] = [];
  for (const ex of mapped) {
    if (seen.has(ex.id)) continue;
    seen.add(ex.id);
    deduped.push(ex);
  }
  return deduped;
}

function normaliseWorkoutToCanonical(raw: any): CanonicalAdminWorkoutFetch {
  // Convert nulls -> undefined for fields that are typed as string | undefined
  const owner_email = typeof raw?.owner_email === "string" ? raw.owner_email : undefined;
  const focus = typeof raw?.focus === "string" ? raw.focus : undefined;
  const notes = typeof raw?.notes === "string" ? raw.notes : undefined;
  const video_url = typeof raw?.video_url === "string" ? raw.video_url : undefined;

  const visibility: "global" | "private" = raw?.visibility === "private" ? "private" : "global";

  const assigned_to = typeof raw?.assigned_to === "string" ? raw.assigned_to : undefined;

  return {
    workout_id: String(raw?.workout_id || raw?.id || "").trim(),
    workout_name: String(raw?.workout_name || "").trim(),
    visibility,
    owner_email,
    focus,
    notes,
    video_url,

    warmup: raw?.warmup ?? null,
    main: raw?.main ?? null,
    finisher: raw?.finisher ?? null,

    recurring: raw?.recurring === true,
    recurring_day: raw?.recurring_day ?? null,
    recurring_start: raw?.recurring_start ?? null,
    recurring_end: raw?.recurring_end ?? null,
    assigned_to: assigned_to ?? null,
  };
}

export default function GymCreateWorkoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const ownerEmail = (session?.user?.email || "").toLowerCase();
  const role = (session?.user as any)?.role || "user";

  const editIdRaw = (router.query.edit as string) || (router.query.id as string) || "";
  const editId = normaliseEditId(editIdRaw);
  const isEdit = Boolean(editId);

  const { data: exData, mutate: mutateExercises } = useSWR("/api/exercises?limit=1000", fetcher, {
    revalidateOnFocus: false,
  });

  const exercises: ExerciseRow[] = useMemo(() => normaliseExercisesPayload(exData), [exData]);

  const { data: strengthList } = useSWR<StrengthExercisesResp>("/api/strength/exercises/list", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const basisOptions = useMemo(() => (Array.isArray(strengthList?.names) ? strengthList!.names : []), [
    strengthList?.names,
  ]);

  const workoutKey = isEdit ? `/api/workouts/admin/${encodeURIComponent(editId)}` : null;

  // Accept any from API and normalise to canonical type
  const { data: workoutRespRaw, error: workoutErr } = useSWR<any>(workoutKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const [initialWorkout, setInitialWorkout] = useState<CanonicalAdminWorkoutFetch | null>(null);
  const [initialWorkoutError, setInitialWorkoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) {
      setInitialWorkout(null);
      setInitialWorkoutError(null);
      return;
    }

    if (workoutRespRaw && !initialWorkout) {
      // Freeze first snapshot so the form doesn't re-initialise on SWR revalidate
      setInitialWorkout(normaliseWorkoutToCanonical(workoutRespRaw));
    }

    if (workoutErr) {
      setInitialWorkoutError(String((workoutErr as any)?.message || workoutErr));
    }
  }, [isEdit, workoutRespRaw, workoutErr, initialWorkout]);

  if (status === "loading") {
    return (
      <div className="container py-4 text-white">
        <div className="ia-tile ia-tile-pad">
          <div className="text-dim">Checking access…</div>
        </div>
      </div>
    );
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4 text-white">
        <div className="ia-tile ia-tile-pad">
          <div className="ia-page-title">Access denied</div>
          <div className="ia-page-subtitle">You do not have permission to view this page.</div>
          <div className="mt-3">
            <Link href="/admin" className="ia-btn ia-btn-outline">
              Back to admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{isEdit ? "Edit Gym Workout • Admin" : "Create Gym Workout • Admin"}</title>
      </Head>

      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        <div className="mb-3">
          <Link href="/admin" className="ia-btn ia-btn-outline">
            ← Back to admin
          </Link>
        </div>

        <div className="ia-page-title">{isEdit ? "Edit gym workout" : "Create gym workout"}</div>
        <div className="ia-page-subtitle">
          {isEdit ? "Update the workout and assignments." : "Build a workout and optionally set recurrence."}
        </div>

        <div className="mt-3 ia-tile ia-tile-pad">
          <GymCreateWorkout
            isEdit={isEdit}
            editId={editId}
            ownerEmail={ownerEmail}
            exercises={exercises}
            basisOptions={basisOptions}
            initialWorkout={initialWorkout}
            initialWorkoutError={initialWorkoutError}
            onExercisesCreated={() => mutateExercises()}
            onDone={(workoutId) => router.push(`/admin/workouts/${workoutId}`)}
          />
        </div>
      </main>

      <BottomNav />
    </>
  );
}

