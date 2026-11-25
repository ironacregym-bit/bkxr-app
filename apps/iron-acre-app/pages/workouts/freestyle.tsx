
// pages/workouts/freestyle.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import BottomNav from "../../components/BottomNav";

const ACTIVITIES = ["Strength training", "Cardio", "Boxing", "Kickboxing", "Mobility"] as const;

export default function FreestyleLogPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [activity, setActivity] = useState<(typeof ACTIVITIES)[number]>("Strength training");
  const [duration, setDuration] = useState<number>(30);
  const [calories, setCalories] = useState<number>(300);
  const [rpe, setRpe] = useState<number>(7);
  // yyyy-mm-ddThh:mm (local) for datetime-local input
  const [whenIso, setWhenIso] = useState<string>(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!session?.user?.email) {
      await signIn("google");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        activity_type: activity,
        duration_minutes: Number(duration) || 0,
        calories_burned: Number(calories) || 0,
        rpe: Number(rpe) || null,
        when: new Date(whenIso).toISOString(),
        notes: notes?.trim() || null,
      };
      const res = await fetch("/api/completions/freestyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to save");
      }
      // Redirect to Home for now; we can later show a toast or update Daily Tasks state
      router.push("/");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <main
        className="container py-3"
        style={{ paddingBottom: 90, color: "#fff", borderRadius: 12, minHeight: "100vh" }}
      >
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>
              Log a freestyle session
            </h1>
            <small className="text-dim">Quickly capture the essentials</small>
          </div>
          <Link
            href="/workout"
            className="btn btn-bxkr-outline btn-sm"
            style={{ borderRadius: 24 }}
            aria-label="Back to Train"
          >
            ← Back
          </Link>
        </div>

        <div className="futuristic-card p-3">
          <div className="row g-3">
            {/* Activity chips */}
            <div className="col-12">
              <label className="form-label small text-dim">Activity</label>
              <div className="d-flex flex-wrap gap-2" role="tablist" aria-label="Activity type">
                {ACTIVITIES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setActivity(a)}
                    className="bxkr-chip"
                    style={{
                      borderColor: activity === a ? "#FF8A2A" : "rgba(255,255,255,0.12)",
                      color: activity === a ? "#FF8A2A" : "#e9eef6",
                    }}
                    aria-pressed={activity === a}
                    role="tab"
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration / Calories */}
            <div className="col-6">
              <label className="form-label small text-dim">Duration (min)</label>
              <input
                type="number"
                className="form-control"
                value={duration}
                min={1}
                step={1}
                onChange={(e) => setDuration(Math.max(0, Number(e.target.value || 0)))}
                inputMode="numeric"
              />
            </div>

            <div className="col-6">
              <label className="form-label small text-dim">Calories (kcal)</label>
              <input
                type="number"
                className="form-control"
                value={calories}
                min={0}
                step={1}
                onChange={(e) => setCalories(Math.max(0, Number(e.target.value || 0)))}
                inputMode="numeric"
              />
            </div>

            {/* Intensity */}
            <div className="col-12">
              <label className="form-label small text-dim">Intensity (RPE 1–10)</label>
              <input
                type="range"
                className="form-range"
                min={1}
                max={10}
                step={1}
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                aria-valuemin={1}
                aria-valuemax={10}
                aria-valuenow={rpe}
              />
              <div className="small">{rpe}</div>
            </div>

            {/* When */}
            <div className="col-12">
              <label className="form-label small text-dim">When</label>
              <input
                type="datetime-local"
                className="form-control"
                value={whenIso}
                onChange={(e) => setWhenIso(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="col-12">
              <label className="form-label small text-dim">Notes (optional)</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="How did it go?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="text-danger mt-3">{error}</div>}

          <div className="d-flex justify-content-end mt-3">
            <button className="btn btn-bxkr" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save session"}
            </button>
          </div>
        </div>
      </main>

      {/* Keep BottomNav present on this page */}
      <BottomNav />
    </>
  );
}
