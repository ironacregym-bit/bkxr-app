
"use client";

import Head from "next/head";
import { useRouter } from "next/router";
import useSWR, { mutate as globalMutate } from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// Fields config (matches your API allowed fields)
const FIELD_DEFS = [
  { key: "step_count", label: "Step Count" },
  { key: "macros_filled", label: "Macros Filled" },
  { key: "assigned_workouts_completed", label: "Workout Completed" },
  { key: "time_outside", label: "Time Outside" },
  { key: "2l_water", label: "2L Water" },
] as const;

type HabitKey = typeof FIELD_DEFS[number]["key"];
type HabitEntry = Partial<Record<HabitKey, boolean>> & {
  id?: string;
  user_email?: string;
  date?: any;
};

export default function HabitPage() {
  const router = useRouter();
  const date =
    (router.query.date as string) || new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useSWR(`/api/habits/logs?date=${date}`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
  });

  const serverEntry: HabitEntry = data?.entry || {};
  const [form, setForm] = useState<Record<HabitKey, boolean>>({
    step_count: !!serverEntry.step_count,
    macros_filled: !!serverEntry.macros_filled,
    assigned_workouts_completed: !!serverEntry.assigned_workouts_completed,
    time_outside: !!serverEntry.time_outside,
    "2l_water": !!serverEntry["2l_water"],
  });
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Keep local form in sync when SWR entry changes (e.g., from other device)
  useEffect(() => {
    setForm({
      step_count: !!serverEntry.step_count,
      macros_filled: !!serverEntry.macros_filled,
      assigned_workouts_completed: !!serverEntry.assigned_workouts_completed,
      time_outside: !!serverEntry.time_outside,
      "2l_water": !!serverEntry["2l_water"],
    });
  }, [
    serverEntry.step_count,
    serverEntry.macros_filled,
    serverEntry.assigned_workouts_completed,
    serverEntry.time_outside,
    serverEntry["2l_water"],
  ]);

  const dirty = useMemo(() => {
    // Compare local form vs server entry booleans
    return FIELD_DEFS.some((f) => {
      const current = !!form[f.key];
      const server = !!serverEntry[f.key];
      return current !== server;
    });
  }, [form, serverEntry]);

  function onToggle(key: HabitKey) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !dirty) return;
    setSubmitting(true);
    try {
      // Send only changed fields is possible; but your API will merge fields safely,
      // so we can send the whole object without schema surprises.
      const res = await fetch(`/api/habits/logs?date=${date}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || "Failed to save daily habits");
      } else {
        // Update SWR cache and give user feedback
        globalMutate(`/api/habits/logs?date=${date}`);
        setSavedAt(Date.now());
      }
    } catch (err) {
      alert("Network error while saving habits");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Daily Habits • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }

          .glass-card {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.35);
            backdrop-filter: blur(10px);
          }
          .bxkr-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 18px;
            border-radius: 999px;
            border: none;
            color: #fff;
            background: linear-gradient(135deg, #ff7a00, #ff9a3a);
            box-shadow: 0 0 12px rgba(255,122,0,0.6);
            transition: box-shadow .2s ease, transform .2s ease, opacity .2s ease;
          }
          .bxkr-btn:hover {
            box-shadow: 0 0 18px rgba(255,122,0,0.9);
            transform: translateY(-1px);
          }
          .bxkr-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .inline-spinner {
            width: 18px; height: 18px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.25);
            border-top-color: #ff8a2a;
            animation: spin .8s linear infinite;
            margin-left: 8px;
          }
          .habit-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 14px;
            margin-bottom: 12px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
          }
          .check {
            width: 22px; height: 22px;
            accent-color: #ff8a2a;
            cursor: pointer;
          }
          .pill-success {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            border-radius: 999px;
            color: #0d1a12;
            background: #64c37a;
            box-shadow: 0 0 10px rgba(100,195,122,0.5);
            font-weight: 600;
            font-size: 0.85rem;
          }
        `}</style>
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          background: "linear-gradient(135deg,#101317,#1f1a14)",
          color: "#fff",
          borderRadius: 12,
          minHeight: "100vh",
        }}
      >
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-link text-light p-0"
              onClick={() => router.back()}
              aria-label="Go back"
              title="Back"
              style={{ textDecoration: "none" }}
            >
              <i className="fas fa-chevron-left" />
            </button>
            <div className="fw-semibold">Daily Habits</div>
            {isLoading && <div className="inline-spinner" />}
          </div>
          <div className="text-end small" style={{ opacity: 0.85 }}>
            <strong>{date}</strong>
          </div>
        </div>

        {/* Success pill after save */}
        {savedAt && (
          <div className="mb-3">
            <span className="pill-success">
              <i className="fas fa-check" /> Saved
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit}>
          <div className="glass-card p-3">
            {isLoading ? (
              <div className="text-light-50">Loading habits…</div>
            ) : (
              FIELD_DEFS.map((f) => (
                <div className="habit-row" key={f.key}>
                  <span style={{ fontWeight: 600 }}>{f.label}</span>
                  <input
                    type="checkbox"
                    className="check"
                    checked={!!form[f.key]}
                    onChange={() => onToggle(f.key)}
                  />
                </div>
              ))
            )}

            <div className="d-flex justify-content-end mt-2">
              <button
                type="submit"
                className="bxkr-btn"
                disabled={submitting || !dirty}
                aria-disabled={submitting || !dirty}
                title={!dirty ? "No changes to save" : "Save changes"}
              >
                {submitting ? (
                  <>
                    <span>Saving</span>
                    <div className="inline-spinner" />
                  </>
                ) : (
                  <>
                    <i className="fas fa-save me-2" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>

      <BottomNav />
    </>
  );
}
