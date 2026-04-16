"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../../../components/BottomNav";
import GymCreateWorkout from "../../../components/gym-create/GymCreateWorkout";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type ExerciseRow = { id: string; exercise_name: string; type?: string };

type StrengthExercisesResp = {
  ok?: boolean;
  names?: string[];
};

type DayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

type AdminRoundFetch = { name: string; order: number; items?: any[] };

type AdminWorkoutFetch = {
  workout_id: string;
  workout_name: string;
  visibility: "global" | "private";
  owner_email?: string;
  focus?: string;
  notes?: string;
  video_url?: string;
  warmup?: AdminRoundFetch | null;
  main?: AdminRoundFetch | null;
  finisher?: AdminRoundFetch | null;
  recurring?: boolean;
  recurring_day?: DayName | string | null;
  recurring_start?: any;
  recurring_end?: any;
  assigned_to?: string | null;
};

export default function GymCreateWorkoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const ownerEmail = (session?.user?.email || "").toLowerCase();
  const role = (session?.user as any)?.role || "user";

  const editIdRaw = (router.query.edit as string) || (router.query.id as string) || "";
  const editId = (typeof editIdRaw === "string" ? editIdRaw.trim() : "") || "";
  const isEdit = Boolean(editId);

  const { data: exData, mutate: mutateExercises } = useSWR("/api/exercises?limit=1000", fetcher, {
    revalidateOnFocus: false,
  });
  const exercises: ExerciseRow[] = Array.isArray(exData?.exercises) ? exData.exercises : [];

  const { data: strengthList } = useSWR<StrengthExercisesResp>("/api/strength/exercises/list", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const basisOptions = Array.isArray(strengthList?.names) ? strengthList!.names! : [];

  const workoutKey = isEdit ? `/api/workouts/admin/${encodeURIComponent(editId)}` : null;
  const { data: workoutResp, error: workoutErr } = useSWR<AdminWorkoutFetch>(workoutKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  // ✅ Early returns AFTER hooks
  if (status === "loading") {
    return <div className="container py-4">Checking access…</div>;
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{isEdit ? "Edit Gym Workout • Admin" : "Create Gym Workout • Admin"}</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">
            ← Back to Admin
          </Link>
        </div>

        <GymCreateWorkout
          isEdit={isEdit}
          editId={editId}
          ownerEmail={ownerEmail}
          exercises={exercises}
          basisOptions={basisOptions}
          initialWorkout={workoutResp ?? null}
          initialWorkoutError={workoutErr ? String((workoutErr as any)?.message || workoutErr) : null}
          onExercisesCreated={() => mutateExercises()}
          onDone={(workoutId) => router.push(`/admin/workouts/${workoutId}`)}
        />
      </main>

      <BottomNav />
    </>
  );
}
