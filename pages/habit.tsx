
// pages/habits.tsx
"use client";

import Head from "next/head";
import { useRouter } from "next/router";
import { useSession, getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";
import BxkrBanner from "../components/BxkrBanner";

export const getServerSideProps: GetServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getSession(context);
  if (!session) {
    return { redirect: { destination: "/landing", permanent: false } };
  }
  return { props: {} };
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function formatYMD(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n.toISOString().slice(0, 10);
}

/**
 * Habit keys must match the API's ALLOWED_FIELDS in /api/habits/logs:
 *  "step_count", "macros_filled", "assigned_workouts_completed", "time_outside", "2l_water"
 * Labels are UX-optimised, and we keep synonyms to read legacy docs.
 */
const HABITS: Array<{ key: string; label: string; synonyms?: string[] }> = [
  { key: "step_count", label: "7,000 Steps Completed", synonyms: ["steps"] },
  { key: "macros_filled", label: "Macros Logged Today" },
  { key: "assigned_workouts_completed", label: "Scheduled Workout Done", synonyms: ["workout_done"] },
  { key: "time_outside", label: "15 Minutes Outdoors" },
  { key: "2l_water", label: "2 Litres of Water", synonyms: ["water"] },
];

// shallow equality for habit booleans
function equalHabitState(a: Record<string, boolean>, b: Record<string, boolean>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (Boolean(a[k]) !== Boolean(b[k])) return false;
  }
  return true;
}

// Read a value supporting synonyms for backwards compatibility
function readBool(entry: any, primaryKey: string, synonyms: string[] = []) {
  if (entry == null) return false;
  if (entry[primaryKey] != null) return !!entry[primaryKey];
  for (const s of synonyms) {
    if (entry[s] != null) return !!entry[s];
  }
  return false;
}

export default function HabitsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const today = new Date();
  const date = formatYMD(today);

  // ✅ Use the route you have: /api/habits/logs
  const { data, error, isLoading, mutate } = useSWR(
    `/api/habits/logs?date=${encodeURIComponent(date)}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  // Normalised last-saved values
  const lastSaved: Record<string, boolean> = useMemo(() => {
    const src = data?.entry || {};
    const out: Record<string, boolean> = {};
    for (const h of HABITS) {
      out[h.key] = readBool(src, h.key, h.synonyms || []);
    }
    return out;
  }, [data]);

  // Local form and dirty state
  const [form, setForm] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setForm(lastSaved);
  }, [lastSaved]);

  const dirty = useMemo(() => !equalHabitState(form, lastSaved), [form, lastSaved]);

  // Success banner timing (like check-in UX)
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [savedAt]);

  function onToggle(key: string) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;

    try {
      // Optimistic UI
      const optimistic = { entry: { ...(data?.entry || {}), ...form } };
      mutate(optimistic, false);

      const res = await fetch(`/api/habits/logs?date=${encodeURIComponent(date)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form), // keys match ALLOWED_FIELDS
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || "Failed to save habits");
        mutate(); // rollback to server truth
        return;
      }

      const json = await res.json();
      mutate(json, false);
      setSavedAt(Date.now()); // trigger green banner
    } catch (err) {
      console.error(err);
      alert("Network error saving habits");
      mutate(); // refetch server truth
    }
  }

  return (
    <>
      <Head>
        <title>Daily Habits • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
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

        {/* ✅ Green success banner (same component pattern as check-in) */}
        {savedAt && (
          <div className="mb-3">
            <BxkrBanner
              title="All set"
              message="Your daily habits have been saved for today."
              href="/train"
              iconLeft="fas fa-check-circle"
              accentColor="#64c37a"
              buttonText="Back to Train"
            />
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit}>
          <div className="habit-card">
            {error ? (
              <div className="text-muted">Failed to load habits</div>
            ) : isLoading ? (
              <div className="text-muted">Loading habits…</div>
            ) : (
              HABITS.map((h) => (
                <div className="habit-row" key={h.key}>
                  <span className="habit-label">{h.label}</span>
                  <input
                    type="checkbox"
                    className="habit-check"
                    checked={!!form[h.key]}
                    onChange={() => onToggle(h.key)}
                  />
                </div>
              ))
            )}

            <div className="d-flex justify-content-end mt-3">
              <button type="submit" className="bxkr-btn" disabled={!dirty}>
                Save Daily Habits
              </button>
            </div>
          </div>
        </form>
      </main>

     <BottomNav />
    </>
  );
}
