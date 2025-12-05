
"use client";

import Head from "next/head";
import { useRouter } from "next/router";
import useSWR, { mutate } from "swr";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function HabitPage() {
  const router = useRouter();
  const date = (router.query.date as string) || new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useSWR(`/api/habits/logs?date=${date}`, fetcher);
  const entry = data?.entry || {};

  const fields = [
    { key: "step_count", label: "Step Count" },
    { key: "macros_filled", label: "Macros Filled" },
    { key: "assigned_workouts_completed", label: "Workout Completed" },
    { key: "time_outside", label: "Time Outside" },
    { key: "2l_water", label: "2L Water" },
  ];

  async function updateField(field: string, value: boolean) {
    await fetch(`/api/habits/logs?date=${date}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    mutate(`/api/habits/logs?date=${date}`);
  }

  return (
    <>
      <Head>
        <title>Daily Habits</title>
      </Head>
      <main
        style={{
          padding: "20px",
          background: "linear-gradient(135deg,#1a1a1a,#2e1a0f)",
          color: "#fff",
          minHeight: "100vh",
        }}
      >
        <h2 style={{ marginBottom: "16px" }}>Daily Habits for {date}</h2>
        {isLoading && <div>Loading habits...</div>}
        {!isLoading &&
          fields.map((f) => (
            <div
              key={f.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px",
                marginBottom: "12px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "12px",
              }}
            >
              <span>{f.label}</span>
              <input
                type="checkbox"
                checked={!!entry[f.key]}
                onChange={(e) => updateField(f.key, e.target.checked)}
                style={{ width: "20px", height: "20px" }}
              />
            </div>
          ))}
      </main>
    </>
  );
}
