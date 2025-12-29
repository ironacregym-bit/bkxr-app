
// pages/admin/exercises/create.tsx
"use client";

import Head from "next/head";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import BottomNav from "../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function CreateExercisePage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

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

  const { data } = useSWR("/api/exercises?limit=200", fetcher, { revalidateOnFocus: false });
  const existing = Array.isArray(data?.exercises) ? data!.exercises : [];

  const [form, setForm] = useState({
    exercise_name: "",
    type: "",
    equipment: "",
    video_url: "",
    met_value: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/exercises/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_name: form.exercise_name.trim(),
          type: form.type.trim(),
          equipment: form.equipment.trim(),
          video_url: form.video_url.trim(),
          met_value: form.met_value ? Number(form.met_value) : null,
          description: form.description.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create exercise");
      setMsg("Exercise created ✅");
      setForm({
        exercise_name: "",
        type: "",
        equipment: "",
        video_url: "",
        met_value: "",
        description: "",
      });
    } catch (e: any) {
      setMsg(e?.message || "Failed to create exercise");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head><title>Create Exercise • Admin</title></Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">
            ← Back to Admin
          </Link>
        </div>

        <h2 className="mb-3">Create Exercise</h2>

        {msg && (
          <div className={`alert ${msg.includes("Failed") ? "alert-danger" : "alert-success"}`}>
            {msg}
          </div>
        )}

        <div className="bxkr-card p-3 mb-3">
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Name</label>
              <input
                className="form-control"
                value={form.exercise_name}
                onChange={(e) => setForm({ ...form, exercise_name: e.target.value })}
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">Type</label>
              <input
                className="form-control"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder="Boxing / Kettlebell / Warm up / Weights / Bodyweight"
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">Equipment</label>
              <input
                className="form-control"
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                placeholder="Kettlebell / Dumbbell / Bodyweight"
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Video URL</label>
              <input
                className="form-control"
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="https://…"
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">MET value (optional)</label>
              <input
                className="form-control"
                type="number"
                min={0}
                step="0.1"
                value={form.met_value}
                onChange={(e) => setForm({ ...form, met_value: e.target.value })}
              />
            </div>

            <div className="col-12">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-3">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Create Exercise"}
            </button>
          </div>
        </div>

        {/* Quick peek at recent exercises */}
        <section className="bxkr-card p-3">
          <h6 className="fw-semibold mb-2">Recent exercises</h6>
          {existing.length === 0 ? (
            <div className="small text-dim">No exercises yet.</div>
          ) : (
            <ul className="small" style={{ listStyle: "none", paddingLeft: 0 }}>
              {existing.slice(0, 8).map((ex: any) => (
                <li key={ex.id} className="mb-1">
                  <code>{ex.exercise_name}</code>{" "}
                  {ex.type ? `• ${ex.type}` : ""}{" "}
                  {ex.equipment ? `• ${ex.equipment}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <BottomNav />
    </>
  );
}
