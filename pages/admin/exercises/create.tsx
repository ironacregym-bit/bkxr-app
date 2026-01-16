
// pages/admin/exercises/create.tsx
"use client";

import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type ExerciseForm = {
  exercise_id: string;
  exercise_name: string;
  type: string;
  equipment: string;
  video_url: string;
  met_value: string;
  description: string;
};

export default function CreateExercisePage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  // Access gate
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

  // Recent exercises list
  const { data } = useSWR("/api/exercises?limit=200", fetcher, { revalidateOnFocus: false, dedupingInterval: 60_000 });
  const existing = Array.isArray(data?.exercises) ? data!.exercises : [];

  // Tabs: single form vs JSON paste
  const [tab, setTab] = useState<"form" | "paste">("form");

  // ---- Single create form state ----
  const [form, setForm] = useState<ExerciseForm>({
    exercise_id: "",
    exercise_name: "",
    type: "",
    equipment: "",
    video_url: "",
    met_value: "",
    description: "",
  });

  // Keep exercise_id == exercise_name (unless user disables this)
  const [autoId, setAutoId] = useState<boolean>(true);

  // When name changes and autoId is on, mirror into exercise_id
  useEffect(() => {
    if (autoId) {
      setForm((f) => ({ ...f, exercise_id: f.exercise_name }));
    }
  }, [form.exercise_name, autoId]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveOne(payload: ExerciseForm): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch("/api/exercises/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Send both—server can store exercise_id as primary/custom ID
          exercise_id: payload.exercise_id?.trim(),
          exercise_name: payload.exercise_name.trim(),
          type: payload.type.trim(),
          equipment: payload.equipment.trim(),
          video_url: payload.video_url.trim(),
          met_value: payload.met_value ? Number(payload.met_value) : null,
          description: payload.description.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create exercise");
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to create exercise" };
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      if (!form.exercise_name.trim()) throw new Error("Exercise name is required.");
      if (!form.exercise_id.trim()) throw new Error("Exercise ID is required.");

      const result = await saveOne(form);
      if (!result.ok) throw new Error(result.error);

      setMsg("Exercise created ✅");
      setForm({
        exercise_id: autoId ? "" : form.exercise_id, // reset ID if auto
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

  // ---- JSON Quick Add (bulk) ----
  const [rawJson, setRawJson] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number; details: string[] } | null>(null);

  function normalizeIncoming(obj: any): ExerciseForm {
    const name = String(obj.exercise_name || obj.name || "").trim();
    const id =
      obj.exercise_id != null && String(obj.exercise_id).trim().length > 0
        ? String(obj.exercise_id).trim()
        : name; // default: ID = name
    return {
      exercise_id: id,
      exercise_name: name,
      type: String(obj.type || "").trim(),
      equipment: String(obj.equipment || "").trim(),
      video_url: String(obj.video_url || "").trim(),
      met_value: obj.met_value != null && obj.met_value !== "" ? String(obj.met_value) : "",
      description: String(obj.description || "").trim(),
    };
  }

  async function handleBulkInsert() {
    setBulkBusy(true);
    setBulkMsg(null);
    setBulkResult(null);
    try {
      if (!rawJson.trim()) throw new Error("Paste JSON first.");
      let parsed: any = JSON.parse(rawJson);
      const arr: any[] = Array.isArray(parsed) ? parsed : [parsed];

      if (!arr.length) throw new Error("No items found in JSON.");

      let success = 0;
      let failed = 0;
      const details: string[] = [];

      // Insert sequentially to keep server calm and errors readable
      for (let i = 0; i < arr.length; i++) {
        const rec = normalizeIncoming(arr[i]);
        if (!rec.exercise_name) {
          failed++;
          details.push(`Item ${i + 1}: Missing exercise_name`);
          continue;
        }
        if (!rec.exercise_id) {
          failed++;
          details.push(`Item ${i + 1}: Missing exercise_id (and could not infer from name)`);
          continue;
        }
        const result = await saveOne(rec);
        if (result.ok) {
          success++;
        } else {
          failed++;
          details.push(`Item ${i + 1} (${rec.exercise_name}): ${result.error}`);
        }
      }

      setBulkResult({ success, failed, details });
      setBulkMsg(`Bulk add complete — ${success} created, ${failed} failed.`);
    } catch (e: any) {
      setBulkMsg(e?.message || "Invalid JSON");
    } finally {
      setBulkBusy(false);
    }
  }

  // Helpful: tiny example JSON to guide format
  const exampleJson = useMemo(
    () =>
      JSON.stringify(
        [
          {
            exercise_name: "Kettlebell Swings",
            exercise_id: "Kettlebell Swings",
            type: "Kettlebell",
            equipment: "Kettlebell",
            video_url: "",
            met_value: 8.0,
            description: "Hinge, snap hips; arms relaxed."
          },
          {
            exercise_name: "Pushups",
            // exercise_id omitted -> will default to exercise_name
            type: "Bodyweight",
            equipment: "Bodyweight",
            description: "Hands under shoulders; body in one line."
          }
        ],
        null,
        2
      ),
    []
  );

  return (
    <>
      <Head>
        <title>Create Exercise • Admin</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="mb-3 d-flex align-items-center justify-content-between">
          <Link href="/admin" className="btn btn-outline-secondary">
            ← Back to Admin
          </Link>

          <div className="btn-group">
            <button
              className={`btn btn-${tab === "form" ? "bxkr" : "outline-light"}`}
              onClick={() => setTab("form")}
            >
              Form
            </button>
            <button
              className={`btn btn-${tab === "paste" ? "bxkr" : "outline-light"}`}
              onClick={() => setTab("paste")}
            >
              Paste JSON
            </button>
          </div>
        </div>

        <h2 className="mb-3">Create Exercise</h2>

        {/* --- Single Form Tab --- */}
        {tab === "form" && (
          <div className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
            {msg && (
              <div className={`alert ${msg.toLowerCase().includes("failed") ? "alert-danger" : "alert-success"}`}>
                {msg}
              </div>
            )}

            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label">Name</label>
                <input
                  className="form-control"
                  value={form.exercise_name}
                  onChange={(e) => setForm({ ...form, exercise_name: e.target.value })}
                  placeholder="e.g., Kettlebell Swings"
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label">Exercise ID</label>
                <div className="d-flex gap-2">
                  <input
                    className="form-control"
                    value={form.exercise_id}
                    onChange={(e) => setForm({ ...form, exercise_id: e.target.value })}
                    placeholder="Will mirror the name if Auto ID is on"
                    disabled={autoId}
                  />
                  <div className="form-check d-flex align-items-center ms-1">
                    <input
                      id="autoId"
                      className="form-check-input"
                      type="checkbox"
                      checked={autoId}
                      onChange={(e) => setAutoId(e.target.checked)}
                    />
                    <label htmlFor="autoId" className="form-check-label ms-1">
                      Auto ID from name
                    </label>
                  </div>
                </div>
                <small className="text-muted">
                  Per your rule, <code>exercise_id</code> = <code>exercise_name</code>. Disable auto to override.
                </small>
              </div>

              <div className="col-6 col-md-3">
                <label className="form-label">Type</label>
                <input
                  className="form-control"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  placeholder="Boxing / Kettlebell / Bodyweight / Weights / Warm up"
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
                  placeholder="Coaching points, standards, regressions"
                />
              </div>
            </div>

            <div className="mt-3">
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Create Exercise"}
              </button>
            </div>
          </div>
        )}

        {/* --- Paste JSON Tab --- */}
        {tab === "paste" && (
          <section className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
            {bulkMsg && (
              <div className={`alert ${bulkMsg.toLowerCase().includes("invalid") ? "alert-danger" : "alert-info"}`}>
                {bulkMsg}
              </div>
            )}

            <label className="form-label">Quick add via JSON</label>
            <textarea
              className="form-control"
              rows={12}
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              placeholder={exampleJson}
            />

            <div className="mt-2 d-flex gap-2">
              <button className="btn btn-outline-light" onClick={handleBulkInsert} disabled={bulkBusy}>
                {bulkBusy ? "Saving…" : "Validate & Save"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setRawJson(exampleJson)}
                disabled={bulkBusy}
                title="Insert example JSON"
              >
                Insert example
              </button>
            </div>

            {bulkResult && (
              <div className="mt-3">
                <div className="fw-semibold">Result</div>
                <div className="small text-dim">
                  {bulkResult.success} created, {bulkResult.failed} failed
                </div>
                {bulkResult.details.length > 0 && (
                  <details className="mt-2">
                    <summary className="small">Details</summary>
                    <ul className="small mt-2">
                      {bulkResult.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </section>
        )}

        {/* Quick peek at recent exercises */}
        <section className="bxkr-card p-3">
          <h6 className="fw-semibold mb-2">Recent exercises</h6>
          {existing.length === 0 ? (
            <div className="small text-dim">No exercises yet.</div>
          ) : (
            <ul className="small" style={{ listStyle: "none", paddingLeft: 0 }}>
              {existing.slice(0, 12).map((ex: any) => (
                <li key={ex.id || ex.exercise_id || ex.exercise_name} className="mb-1">
                  <code>{ex.exercise_name}</code>{" "}
                  {ex.exercise_id ? `• id: ${ex.exercise_id}` : ""}{" "}
                  {ex.type ? `• ${ex.type}` : ""} {ex.equipment ? `• ${ex.equipment}` : ""}
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
