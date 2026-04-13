"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";

import BottomNav from "../../../components/BottomNav";
import StrengthPrescriptionEditor, {
  StrengthSpec,
} from "../../../components/gym-create/StrengthPrescriptionEditor";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type DayName = typeof DAYS[number];

const mkUid = () => {
  try {
    // @ts-ignore
    return crypto?.randomUUID
      ? crypto.randomUUID()
      : `uid_${Math.random().toString(36).slice(2)}`;
  } catch {
    return `uid_${Math.random().toString(36).slice(2)}`;
  }
};

type SingleItem = {
  uid: string;
  type: "Single";
  order: number;
  exercise_id: string;
  sets?: number;
  reps?: string;
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
  strength?: StrengthSpec | null;
};

type GymRound = {
  name: string;
  order: number;
  items: SingleItem[];
};

export default function GymCreateWorkoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const ownerEmail = (session?.user?.email || "").toLowerCase();
  const role = (session?.user as any)?.role || "user";

  if (status === "loading") return <div className="container py-4">Checking access…</div>;
  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access denied</h3>
      </div>
    );
  }

  const [meta, setMeta] = useState({
    workout_name: "",
    focus: "",
    notes: "",
    video_url: "",
    visibility: "global" as "global" | "private",
  });

  const [main, setMain] = useState<GymRound>({
    name: "Main Set",
    order: 1,
    items: [],
  });

  function addSingle() {
    setMain((r) => ({
      ...r,
      items: [
        ...r.items,
        {
          uid: mkUid(),
          type: "Single",
          order: r.items.length + 1,
          exercise_id: "",
          sets: 3,
          reps: "",
        },
      ],
    }));
  }

  function updateSingle(idx: number, patch: Partial<SingleItem>) {
    setMain((r) => ({
      ...r,
      items: r.items.map((it, i) =>
        i === idx ? { ...it, ...patch } : it
      ),
    }));
  }

  function stripRound(r: GymRound | null) {
    if (!r) return null;
    return {
      name: r.name,
      order: r.order,
      items: r.items.map((it) => ({
        type: "Single",
        order: it.order,
        exercise_id: it.exercise_id,
        sets: it.sets,
        reps: it.reps,
        weight_kg: it.weight_kg ?? null,
        rest_s: it.rest_s ?? null,
        notes: it.notes ?? null,
        strength: it.strength
          ? {
              basis_exercise: it.strength.basis_exercise ?? null,
              percent_1rm: it.strength.percent_1rm ?? null,
              percent_min: it.strength.percent_min ?? null,
              percent_max: it.strength.percent_max ?? null,
              rounding_kg: it.strength.rounding_kg ?? null,
              mode: it.strength.mode ?? null,
            }
          : null,
      })),
    };
  }

  async function save() {
    const body = {
      workout_name: meta.workout_name.trim(),
      visibility: meta.visibility,
      owner_email: meta.visibility === "private" ? ownerEmail : undefined,
      focus: meta.focus.trim(),
      notes: meta.notes.trim(),
      video_url: meta.video_url.trim(),
      main: stripRound(main),
    };

    const res = await fetch("/api/workouts/gym-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Failed to save workout");
      return;
    }

    router.push(`/admin/workouts/${json.workout_id}`);
  }

  return (
    <>
      <Head>
        <title>Create Gym Workout</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <Link href="/admin" className="btn btn-outline-secondary mb-3">
          ← Back to Admin
        </Link>

        <section className="futuristic-card p-3 mb-3">
          <label className="form-label">Workout Name</label>
          <input
            className="form-control"
            value={meta.workout_name}
            onChange={(e) => setMeta({ ...meta, workout_name: e.target.value })}
          />
        </section>

        <section className="futuristic-card p-3 mb-3">
          <h6>Main Set</h6>

          {main.items.map((it, idx) => (
            <div key={it.uid} className="mb-3">
              <label className="form-label">Exercise</label>
              <input
                className="form-control"
                value={it.exercise_id}
                onChange={(e) => updateSingle(idx, { exercise_id: e.target.value })}
              />

              <div className="row g-2 mt-1">
                <div className="col-4">
                  <label className="form-label">Sets</label>
                  <input
                    className="form-control"
                    type="number"
                    value={it.sets ?? ""}
                    onChange={(e) => updateSingle(idx, { sets: Number(e.target.value) })}
                  />
                </div>

                <div className="col-8">
                  <label className="form-label">Reps</label>
                  <input
                    className="form-control"
                    value={it.reps ?? ""}
                    onChange={(e) => updateSingle(idx, { reps: e.target.value })}
                  />
                </div>

                {!it.strength && (
                  <div className="col-4">
                    <label className="form-label">Weight (kg)</label>
                    <input
                      className="form-control"
                      type="number"
                      value={it.weight_kg ?? ""}
                      onChange={(e) =>
                        updateSingle(idx, {
                          weight_kg: Number(e.target.value) || null,
                        })
                      }
                    />
                  </div>
                )}
              </div>

              <StrengthPrescriptionEditor
                value={it.strength}
                onChange={(strength) =>
                  updateSingle(idx, {
                    strength,
                    weight_kg: null,
                  })
                }
              />
            </div>
          ))}

          <button
            className="btn btn-sm"
            style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }}
            onClick={addSingle}
          >
            + Add Exercise
          </button>
        </section>

        <button
          className="btn w-100"
          style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }}
          onClick={save}
        >
          Save Workout
        </button>
      </main>

      <BottomNav />
    </>
  );
}
