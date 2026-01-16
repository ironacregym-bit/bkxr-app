
// pages/admin/exercises/create.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type ExerciseForm = {
  exercise_id: string;
  exercise_name: string;
  type: string;
  equipment: string;
  video_url: string;
  met_value: string; // keep as string for controlled input; convert on save
  description: string;
};

type ExerciseListItem = {
  id?: string;                // some older docs may have "id"
  exercise_id?: string;       // your custom ID (new)
  exercise_name: string;
  type?: string;
  equipment?: string;
};

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export default function CreateExercisePage() {
  const mounted = useMounted();
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const isAllowed = !!session && (role === "admin" || role === "gym");

  // SWR key is gated; hook is ALWAYS called → avoids hook-order mismatch (#310).
  const swrKey = mounted && isAllowed ? "/api/exercises?limit=500" : null;
  const { data } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const exercises: ExerciseListItem[] = Array.isArray(data?.exercises) ? data!.exercises : [];

  // Right-pane tabs
  const [tab, setTab] = useState<"form" | "paste">("form");

  // Selected item from sidebar (edit mode), or null for creating new
  const [selected, setSelected] = useState<ExerciseListItem | null>(null);

  // For "create": keep exercise_id === exercise_name by default
  const [autoId, setAutoId] = useState<boolean>(true);

  // Main form state
  const [form, setForm] = useState<ExerciseForm>({
    exercise_id: "",
    exercise_name: "",
    type: "",
    equipment: "",
    video_url: "",
    met_value: "",
    description: "",
  });

  // Keep ID mirrored while autoId is on
  useEffect(() => {
    if (autoId) setForm((f) => ({ ...f, exercise_id: f.exercise_name }));
  }, [form.exercise_name, autoId]);

  // When editing an existing item, disable autoId so you can manually adjust
  useEffect(() => {
    if (selected) setAutoId(false);
  }, [selected]);

  function loadToForm(ex: ExerciseListItem) {
    setSelected(ex);
    setTab("form");
    setForm({
      exercise_id: (ex.exercise_id || ex.id || ex.exercise_name || "").trim(),
      exercise_name: ex.exercise_name || "",
      type: ex.type || "",
      equipment: ex.equipment || "",
      video_url: "",
      met_value: "",
      description: "",
    });
  }

  function resetToNew() {
    setSelected(null);
    setAutoId(true);
    setTab("form");
    setForm({
      exercise_id: "",
      exercise_name: "",
      type: "",
      equipment: "",
      video_url: "",
      met_value: "",
      description: "",
    });
  }

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveOne(payload: ExerciseForm, upsert: boolean): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/exercises/create${upsert ? "?upsert=true" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      if (!res.ok) throw new Error(json?.error || "Failed to save exercise");
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to save exercise" };
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      if (!form.exercise_name.trim()) throw new Error("Exercise name is required.");
      if (!form.exercise_id.trim()) throw new Error("Exercise ID is required.");

      const upsert = !!selected; // editing existing → upsert
      const result = await saveOne(form, upsert);
      if (!result.ok) throw new Error(result.error);

      setMsg(upsert ? "Exercise updated ✅" : "Exercise created ✅");
      if (!upsert) resetToNew();
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ---------- Bulk JSON quick-add ----------
  const [rawJson, setRawJson] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number; details: string[] } | null>(null);

  function normalizeIncoming(obj: any): ExerciseForm {
    const name = String(obj.exercise_name || obj.name || "").trim();
    const id =
      obj.exercise_id != null && String(obj.exercise_id).trim().length > 0
        ? String(obj.exercise_id).trim()
        : name; // default to name (your rule)
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
      const parsed: any = JSON.parse(rawJson);
      const arr: any[] = Array.isArray(parsed) ? parsed : [parsed];
      if (!arr.length) throw new Error("No items found in JSON.");

      let success = 0;
      let failed = 0;
      const details: string[] = [];

      for (let i = 0; i < arr.length; i++) {
        const rec = normalizeIncoming(arr[i]);
        if (!rec.exercise_name) {
          failed++; details.push(`Item ${i + 1}: Missing exercise_name`); continue;
        }
        if (!rec.exercise_id) {
          failed++; details.push(`Item ${i + 1}: Missing exercise_id (and could not infer from name)`); continue;
        }
        const result = await saveOne(rec, /* upsert */ true);
        if (result.ok) success++;
        else { failed++; details.push(`Item ${i + 1} (${rec.exercise_name}): ${result.error}`); }
      }

      setBulkResult({ success, failed, details });
      setBulkMsg(`Bulk add complete — ${success} created/updated, ${failed} failed.`);
    } catch (e: any) {
      setBulkMsg(e?.message || "Invalid JSON");
    } finally {
      setBulkBusy(false);
    }
  }

  const exampleJson = useMemo(
    () =>
      JSON.stringify(
        [
          {
            exercise_name: "Kettlebell Swings",
            exercise_id: "Kettlebell Swings",
            type: "Kettlebell",
            equipment: "Kettlebell",
            met_value: 8.0,
            description: "Hinge, snap hips; arms relaxed."
          },
          {
            exercise_name: "Pushups",
            // exercise_id omitted → will default to exercise_name
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

  // ---------- Render (no early returns to keep hook order stable) ----------
  return (
    <>
      <Head><title>Create Exercise • Admin</title></Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        {/* Top bar */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">← Back to Admin</Link>

          {/* Desktop tab toggles (right pane) */}
          <div className="btn-group d-none d-md-inline-flex">
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

        {/* Auth / loading gates as UI only (hooks above remain stable) */}
        {!mounted || status === "loading" ? (
          <div className="container py-4">Checking access…</div>
        ) : !isAllowed ? (
          <div className="container py-4">
            <h3>Access Denied</h3>
            <p>You do not have permission to view this page.</p>
          </div>
        ) : (
          <div className="row">
            {/* Sidebar (desktop) */}
            <aside className="col-md-4 d-none d-md-block">
              <div
                className="bxkr-card p-3"
                style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, maxHeight: "70vh", overflow: "auto" }}
              >
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="m-0">Exercises</h6>
                  <button className="btn btn-sm btn-outline-light" onClick={resetToNew}>+ New</button>
                </div>
                {exercises.length === 0 ? (
                  <div className="small text-dim">No exercises yet.</div>
                ) : (
                  <ul className="small" style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
                    {exercises.map((ex) => {
                      const key = ex.exercise_id || ex.id || ex.exercise_name;
                      const isSel = selected && (selected.exercise_id || selected.id || selected.exercise_name) === key;
                      return (
                        <li
                          key={key}
                          className={`px-2 py-1 mb-1 rounded ${isSel ? "bg-dark" : "bg-transparent"}`}
                          style={{ cursor: "pointer" }}
                          onClick={() => loadToForm(ex)}
                          title="Click to edit"
                        >
                          <div className="fw-semibold">{ex.exercise_name}</div>
                          <div className="text-dim">
                            {ex.type ? `• ${ex.type}` : ""} {ex.equipment ? `• ${ex.equipment}` : ""}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            {/* Right pane */}
            <section className="col-12 col-md-8">
              {/* Mobile tabs */}
              <div className="btn-group d-md-none mb-2">
                <button className={`btn btn-${tab === "form" ? "bxkr" : "outline-light"}`} onClick={() => setTab("form")}>Form</button>
                <button className={`btn btn-${tab === "paste" ? "bxkr" : "outline-light"}`} onClick={() => setTab("paste")}>Paste JSON</button>
              </div>

              {/* Form tab */}
              {tab === "form" && (
                <div className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
                  {msg && (
                    <div className={`alert ${msg.toLowerCase().includes("fail") ? "alert-danger" : "alert-success"}`}>{msg}</div>
                  )}

                  <div className="row g-2">
                    <div className="col-12 col-lg-6">
                      <label className="form-label">Name</label>
                      <input
                        className="form-control"
                        value={form.exercise_name}
                        onChange={(e) => setForm({ ...form, exercise_name: e.target.value })}
                        placeholder="e.g., Kettlebell Swings"
                      />
                    </div>

                    <div className="col-12 col-lg-6">
                      <label className="form-label">Exercise ID</label>
                      <div className="d-flex gap-2">
                        <input
                          className="form-control"
                          value={form.exercise_id}
                          onChange={(e) => setForm({ ...form, exercise_id: e.target.value })}
                          placeholder="Mirrors the name when Auto ID is on"
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
                          <label htmlFor="autoId" className="form-check-label ms-1">Auto ID from name</label>
                        </div>
                      </div>
                      <small className="text-muted">
                        Per your rule, <code>exercise_id</code> = <code>exercise_name</code>. Disable to override.
                      </small>
                    </div>

                    <div className="col-6 col-lg-3">
                      <label className="form-label">Type</label>
                      <input
                        className="form-control"
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        placeholder="Kettlebell / Boxing / Bodyweight / Weights / Warm up"
                      />
                    </div>

                    <div className="col-6 col-lg-3">
                      <label className="form-label">Equipment</label>
                      <input
                        className="form-control"
                        value={form.equipment}
                        onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                        placeholder="Kettlebell / Dumbbell / Bodyweight"
                      />
                    </div>

                    <div className="col-12 col-lg-6">
                      <label className="form-label">Video URL</label>
                      <input
                        className="form-control"
                        value={form.video_url}
                        onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                        placeholder="https://…"
                      />
                    </div>

                    <div className="col-6 col-lg-3">
                      <label className="form-label">MET value (optional)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        step={0.1}
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
                        placeholder="Coaching cues, standards, regressions"
                      />
                    </div>
                  </div>

                  <div className="mt-3 d-flex gap-2">
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? "Saving…" : (selected ? "Save changes" : "Create Exercise")}
                    </button>
                    {selected && (
                      <button className="btn btn-outline-light" onClick={resetToNew}>New exercise</button>
                    )}
                  </div>
                </div>
              )}

              {/* Paste JSON tab */}
              {tab === "paste" && (
                <section className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
                  {bulkMsg && (
                    <div className={`alert ${bulkMsg.toLowerCase().includes("invalid") ? "alert-danger" : "alert-info"}`}>{bulkMsg}</div>
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
                        {bulkResult.success} created/updated, {bulkResult.failed} failed
                      </div>
                      {bulkResult.details.length > 0 && (
                        <details className="mt-2">
                          <summary className="small">Details</summary>
                          <ul className="small mt-2">
                            {bulkResult.details.map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Mobile fallback list when there’s no sidebar */}
              <section className="bxkr-card p-3 d-md-none">
                <h6 className="fw-semibold mb-2">Recent exercises</h6>
                {exercises.length === 0 ? (
                  <div className="small text-dim">No exercises yet.</div>
                ) : (
                  <ul className="small" style={{ listStyle: "none", paddingLeft: 0 }}>
                    {exercises.slice(0, 12).map((ex) => {
                      const key = ex.exercise_id || ex.id || ex.exercise_name;
                      return (
                        <li key={key} className="mb-1">
                          <button className="btn btn-sm btn-outline-light" onClick={() => loadToForm(ex)}>Edit</button>{" "}
                          <code>{ex.exercise_name}</code> {ex.type ? `• ${ex.type}` : ""} {ex.equipment ? `• ${ex.equipment}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </section>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
