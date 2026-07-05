// pages/habits.tsx
"use client";

import Head from "next/head";
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
    return {
      redirect: {
        destination: "/landing",
        permanent: false,
      },
    };
  }

  return { props: {} };
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function formatYMD(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n.toISOString().slice(0, 10);
}

const HABITS: Array<{
  key: string;
  label: string;
  synonyms?: string[];
}> = [
  {
    key: "step_count",
    label: "7,000 Steps Completed",
    synonyms: ["steps"],
  },
  {
    key: "macros_filled",
    label: "Macros Logged Today",
  },
  {
    key: "assigned_workouts_completed",
    label: "Scheduled Workout Done",
    synonyms: ["workout_done"],
  },
  {
    key: "time_outside",
    label: "15 Minutes Outdoors",
  },
  {
    key: "2l_water",
    label: "2 Litres Of Water",
    synonyms: ["water"],
  },
];

function equalHabitState(
  a: Record<string, boolean>,
  b: Record<string, boolean>
) {
  const keys = new Set([
    ...Object.keys(a),
    ...Object.keys(b),
  ]);

  for (const k of keys) {
    if (Boolean(a[k]) !== Boolean(b[k])) {
      return false;
    }
  }

  return true;
}

function readBool(
  entry: any,
  primaryKey: string,
  synonyms: string[] = []
) {
  if (entry == null) return false;

  if (entry[primaryKey] != null) {
    return !!entry[primaryKey];
  }

  for (const s of synonyms) {
    if (entry[s] != null) {
      return !!entry[s];
    }
  }

  return false;
}

export default function HabitsPage() {
  useSession();

  const router = useRouter();

  const today = new Date();
  const date = formatYMD(today);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/habits/logs?date=${encodeURIComponent(date)}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const lastSaved: Record<string, boolean> = useMemo(() => {
    const src = data?.entry || {};

    const out: Record<string, boolean> = {};

    for (const h of HABITS) {
      out[h.key] = readBool(
        src,
        h.key,
        h.synonyms || []
      );
    }

    return out;
  }, [data]);

  const [form, setForm] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setForm(lastSaved);
  }, [lastSaved]);

  const dirty = useMemo(
    () => !equalHabitState(form, lastSaved),
    [form, lastSaved]
  );

  const completedCount = useMemo(
    () =>
      HABITS.filter((h) => !!form[h.key]).length,
    [form]
  );

  const progressPct = Math.round(
    (completedCount / HABITS.length) * 100
  );

  const [savedAt, setSavedAt] =
    useState<number | null>(null);

  useEffect(() => {
    if (!savedAt) return;

    const t = setTimeout(
      () => setSavedAt(null),
      2500
    );

    return () => clearTimeout(t);
  }, [savedAt]);

  function onToggle(key: string) {
    setForm((prev) => ({
      ...prev,
      !prev[key],
    }));
  }

  async function onSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!dirty) return;

    try {
      const optimistic = {
        entry: {
          ...(data?.entry || {}),
          ...form,
        },
      };

      mutate(optimistic, false);

      const res = await fetch(
        `/api/habits/logs?date=${encodeURIComponent(
          date
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      if (!res.ok) {
        const j = await res
          .json()
          .catch(() => ({}));

        alert(
          j?.error ||
            "Failed to save habits"
        );

        mutate();
        return;
      }

      const json = await res.json();

      mutate(json, false);

      setSavedAt(Date.now());
    } catch (err) {
      console.error(err);

      alert(
        "Network error saving habits"
      );

      mutate();
    }
  }

  return (
    <>
      <Head>
        <title>
          Daily Habits • Iron Acre
        </title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </Head>

      <main
        className="container py-3"
        style={{
          color: "#fff",
          minHeight: "100vh",
          paddingBottom: "100px",
        }}
      >
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <button
              type="button"
              className="ia-btn-muted"
              onClick={() =>
                router.back()
              }
            >
              <i className="fas fa-chevron-left" />
            </button>

            <div className="small text-dim">
              {date}
            </div>
          </div>

          <div className="ia-kicker mt-3">
            <i className="fas fa-seedling" />
            habits
          </div>

          <div className="ia-page-title mt-2">
            Daily Habits
          </div>

          <div className="ia-page-subtitle">
            Complete the actions that
            support your training,
            recovery and nutrition
            today.
          </div>
        </section>

        {savedAt && (
          <div className="mb-3">
            <div className="ia-inline-note-success">
              <i className="fas fa-check-circle me-2" />
              Daily habits saved
              successfully.
            </div>
          </div>
        )}

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-stats-row">
            <div className="ia-stat">
              <div className="ia-stat-value">
                {completedCount}
              </div>

              <div className="ia-stat-label">
                Completed
              </div>
            </div>

            <div className="ia-stat">
              <div className="ia-stat-value">
                {HABITS.length -
                  completedCount}
              </div>

              <div className="ia-stat-label">
                Remaining
              </div>
            </div>

            <div className="ia-stat">
              <div className="ia-stat-value">
                {progressPct}%
              </div>

              <div className="ia-stat-label">
                Progress
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={onSubmit}>
          <section className="ia-tile ia-tile-pad mb-3">
            {error ? (
              <div className="text-dim">
                Failed to load habits
              </div>
            ) : isLoading ? (
              <div className="text-dim">
                Loading habits...
              </div>
            ) : (
              HABITS.map((h) => (
                <div
                  key={h.key}
                  className={`ia-task-card ${
                    form[h.key]
                      ? "ia-task-card--highlight"
                      : ""
                  }`}
                  onClick={() =>
                    onToggle(h.key)
                  }
                  style={{
                    cursor: "pointer",
                  }}
                >
                  <div className="ia-task-card__main">
                    <div className="ia-task-card__title">
                      {h.label}
                    </div>

                    <div className="ia-task-card__subtitle">
                      Tap to mark
                      complete
                    </div>
                  </div>

                  <div className="ia-task-card__aside">
                    <div
                      className={`ia-badge ${
                        form[h.key]
                          ? "ia-badge-neon"
                          : ""
                      }`}
                    >
                      {form[h.key]
                        ? "Done"
                        : "Open"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>

          <button
            type="submit"
            className="ia-btn-primary w-100"
            disabled={!dirty}
          >
            <i className="fas fa-save me-2" />
            Save Daily Habits
          </button>
        </form>
      </main>

      <BottomNav />
    </>
  );
}
