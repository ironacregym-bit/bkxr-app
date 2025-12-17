
// pages/habits.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession, getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";

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

// Daily habit definitions (new wording)
const HABITS = [
  { key: "steps", label: "7,000 Steps Completed" },
  { key: "macros_filled", label: "Macros Logged Today" },
  { key: "workout_done", label: "Scheduled Workout Done" },
  { key: "time_outside", label: "15 Minutes Outdoors" },
  { key: "water", label: "2 Litres of Water" },
];

// shallow equality for habit booleans
function equalHabitState(a: Record<string, boolean>, b: Record<string, boolean>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (Boolean(a[k]) !== Boolean(b[k])) return false;
  }
  return true;
}

export default function HabitsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const today = new Date();
  const date = formatYMD(today);

  // Load today’s habits (adjust the URL if your API route name differs)
  const { data, error, isLoading, mutate } = useSWR(
    `/api/habits/daily?date=${encodeURIComponent(date)}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  // last saved values → normalised record of booleans
  const lastSaved: Record<string, boolean> = useMemo(() => {
    const src = data?.entry || {};
    const out: Record<string, boolean> = {};
    for (const h of HABITS) out[h.key] = !!src[h.key];
    return out;
  }, [data]);

  // local form state
  const [form, setForm] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setForm(lastSaved);
  }, [lastSaved]);

  // dirty flag
  const dirty = useMemo(() => !equalHabitState(form, lastSaved), [form, lastSaved]);

  // success pill timing
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [savedAt]);

  // optional auto-save
  const [autoSave, setAutoSave] = useState(true);
  useEffect(() => {
    if (!autoSave || !dirty) return;
    const t = setTimeout(() => {
      (async () => {
        try {
          const optimistic = { entry: { ...(data?.entry || {}), ...form } };
          mutate(optimistic, false);

          const res = await fetch(`/api/habits/daily?date=${encodeURIComponent(date)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });

          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            console.warn(j?.error || "Auto-save failed");
            mutate(); // rollback to server truth
            return;
          }

          const json = await res.json();
          mutate(json, false);
          setSavedAt(Date.now());
        } catch (e) {
          console.error(e);
          mutate(); // rollback
        }
      })();
    }, 600); // debounce

    return () => clearTimeout(t);
  }, [autoSave, dirty, form, date]);

  function onToggle(key: string) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;

    try {
      const optimistic = { entry: { ...(data?.entry || {}), ...form } };
      mutate(optimistic, false);

      const res = await fetch(`/api/habits/daily?date=${encodeURIComponent(date)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || "Failed to save habits");
        mutate(); // rollback
        return;
      }

      const json = await res.json();
      mutate(json, false);
      setSavedAt(Date.now());
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
          background: "linear-gradient(135deg,#1a1a1a,#2c2c2c)",
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

        {/* Success pill */}
        {savedAt && (
          <div className="mb-3">
            <span className="pill-success">
              <i className="fas fa-check" /> Saved
            </span>
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

            <div className="d-flex justify-content-between mt-3">
              <label className="form-check form-switch">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                />
                <span className="ms-2">Auto‑save</span>
              </label>

              <button type="submit" className="bxkr-btn" disabled={!dirty}>
                Save Daily Habits
              </button>
            </div>
          </div>
        </form        </form>

        <div className="mt-3 text-center">
          /train
            <i className="fa-solid fa-dumbbell nav-icon" aria-hidden="true" />
            <span>Back to Train</span>
          </Link>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
