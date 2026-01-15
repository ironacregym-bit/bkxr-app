
// pages/admin/exercises/index.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";

type Exercise = {
  id: string;
  exercise_name: string;
  type: string;
  equipment: string;
  video_url: string;
  met_value: number | null;
  description?: string;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  last_modified_by?: string | null;
};

type ListResp = {
  exercises: Exercise[];
  nextCursor?: string | null;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function AdminExercisesManager() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const userEmail = session?.user?.email || "";

  // Mount guard (hydration safety)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ----- Local UI state (always declared before any conditional rendering) -----
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileEditing, setMobileEditing] = useState(false);

  // Build list key; ensure hooks are always called, but key=null when not allowed
  const listKey = useMemo(() => {
    if (!mounted || status === "loading") return null;
    const isAllowed = !!session && (role === "admin" || role === "gym");
    if (!isAllowed) return null;

    const qs = new URLSearchParams();
    if (query.trim()) qs.set("q", query.trim());
    if (filterType.trim()) qs.set("type", filterType.trim());
    qs.set("limit", "300");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return `/api/exercises${suffix}`;
  }, [mounted, status, session, role, query, filterType]);

  const { data: listData, mutate: mutateList } = useSWR<ListResp>(listKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const items = Array.isArray(listData?.exercises) ? listData!.exercises : [];

  // Selected exercise fetch (key is null if none selected or not allowed)
  const getKey = useMemo(() => {
    if (!mounted || status === "loading" || !selectedId) return null;
    const isAllowed = !!session && (role === "admin" || role === "gym");
    if (!isAllowed) return null;
    return `/api/exercises/get?id=${encodeURIComponent(selectedId)}`;
  }, [mounted, status, session, role, selectedId]);
  const { data: selectedData, mutate: mutateSelected } = useSWR<{ exercise?: Exercise }>(
    getKey,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 20_000 }
  );

  const selected = selectedData?.exercise || null;

  // Editor form (always declared)
  const [form, setForm] = useState({
    exercise_name: "",
    type: "",
    equipment: "",
    video_url: "",
    met_value: "" as string | number,
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Hydrate form when a new item is selected
  useEffect(() => {
    if (!selected) return;
    setForm({
      exercise_name: selected.exercise_name || "",
      type: selected.type || "",
      equipment: selected.equipment || "",
      video_url: selected.video_url || "",
      met_value: selected.met_value != null ? selected.met_value : "",
      description: selected.description || "",
    });
  }, [selected]); // hydrate every time the selected object changes

  function newExercise() {
    setSelectedId(null);
    setForm({
      exercise_name: "",
      type: "",
      equipment: "",
      video_url: "",
      met_value: "",
      description: "",
    });
    setMobileEditing(true);
    setMsg(null);
  }

  async function saveExercise() {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        id: selectedId || undefined,
        exercise_name: String(form.exercise_name || "").trim(),
        type: String(form.type || "").trim(),
        equipment: String(form.equipment || "").trim(),
        video_url: String(form.video_url || "").trim(),
        met_value:
          form.met_value === "" || form.met_value === null
            ? null
            : Number(form.met_value),
        description: String(form.description || "").trim(),
      };

      if (!payload.exercise_name) {
        setMsg("Name is required.");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/exercises/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to save exercise");

      setMsg(selectedId ? "Saved changes ✅" : "Exercise created ✅");
      // Refresh list + selected
      mutateList();
      if (j?.exercise?.id) {
        setSelectedId(j.exercise.id);
        mutateSelected();
      }
      setMobileEditing(false);
    } catch (e: any) {
      setMsg(e?.message || "Failed to save exercise");
    } finally {
      setSaving(false);
    }
  }

  async function deleteExercise() {
    if (!selectedId) return;
    if (!confirm("Delete this exercise? This cannot be undone.")) return;
    setDeleting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/exercises/delete?id=${encodeURIComponent(selectedId)}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to delete exercise");
      setMsg("Exercise deleted 🗑️");
      setSelectedId(null);
      mutateList();
      setMobileEditing(false);
      setForm({
        exercise_name: "",
        type: "",
        equipment: "",
        video_url: "",
        met_value: "",
        description: "",
      });
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete exercise");
    } finally {
      setDeleting(false);
    }
  }

  // ----- Render (single return; no early returns before hooks) -----
  const isAllowed = !!session && (role === "admin" || role === "gym");

  return (
    <>
      <Head><title>Exercises • Admin</title></Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        {/* Access gates rendered in-place (no early return) */}
        {(!mounted || status === "loading") && (
          <div className="py-4">Checking access…</div>
        )}

        {mounted && status !== "loading" && !isAllowed && (
          <div className="py-4">
            <h3>Access Denied</h3>
            <p>You do not have permission to view this page.</p>
            <Link href="/more" className="btn btn-outline-secondary">← Back</Link>
          </div>
        )}

        {mounted && status !== "loading" && isAllowed && (
          <>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <Link href="/admin" className="btn btn-outline-secondary">← Admin</Link>
                <h2 className="m-0">Exercises</h2>
              </div>

              {/* Mobile: create button */}
              <div className="d-md-none">
                <button className="btn btn-bxkr" onClick={newExercise}>
                  <i className="fas fa-plus me-2" /> Create
                </button>
              </div>
            </div>

            {msg && (
              <div className={`alert ${msg.toLowerCase().includes("failed") ? "alert-danger" : "alert-success"}`}>
                {msg}
              </div>
            )}

            <div className="row gx-3">
              {/* List pane */}
              <div className={`col-12 col-md-4 ${mobileEditing ? "d-none d-md-block" : ""}`}>
                <div className="futuristic-card p-3">
                  <div className="d-flex gap-2 mb-2">
                    <input
                      className="form-control"
                      placeholder="Search name or type…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className="btn btn-outline-light" onClick={() => setQuery("")}>
                      <i className="fas fa-times" />
                    </button>
                  </div>

                  <div className="d-flex gap-2 mb-2">
                    <input
                      className="form-control"
                      placeholder="Filter type (e.g., Kettlebell)"
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                    />
                    <button className="btn btn-outline-light" onClick={() => setFilterType("")}>
                      <i className="fas fa-times" />
                    </button>
                    <button className="btn btn-bxkr d-none d-md-inline" onClick={newExercise}>
                      <i className="fas fa-plus me-2" /> New
                    </button>
                  </div>

                  <div style={{ maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
                    {!items.length ? (
                      <div className="text-muted">No exercises found.</div>
                    ) : (
                      <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
                        {items.map((ex) => {
                          const active = selectedId === ex.id;
                          return (
                            <li key={ex.id}>
                              <button
                                type="button"
                                onClick={() => { setSelectedId(ex.id); setMobileEditing(true); setMsg(null); }}
                                className="w-100 text-start"
                                style={{
                                  border: "1px solid rgba(255,255,255,0.12)",
                                  background: active ? "rgba(255,138,42,0.13)" : "rgba(255,255,255,0.04)",
                                  color: "#fff",
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                  marginBottom: 8,
                                }}
                              >
                                <div className="fw-semibold">{ex.exercise_name}</div>
                                <div className="small text-dim">
                                  {ex.type || "—"} {ex.equipment ? `• ${ex.equipment}` : ""}
                                  {ex.met_value != null ? ` • ${ex.met_value} METs` : ""}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Editor pane */}
              <div className={`col-12 col-md-8 ${mobileEditing ? "" : "d-none d-md-block"}`}>
                <div className="futuristic-card p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="m-0">{selectedId ? "Edit exercise" : "Create exercise"}</h5>
                    <div className="d-md-none">
                      <button className="btn btn-outline-light btn-sm" onClick={() => setMobileEditing(false)}>
                        <i className="fas fa-chevron-left me-2" /> Back to list
                      </button>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-12 col-lg-6">
                      <label className="form-label">Name</label>
                      <input
                        className="form-control"
                        value={form.exercise_name}
                        onChange={(e) => setForm({ ...form, exercise_name: e.target.value })}
                        placeholder="e.g., Kettlebell Swing"
                      />
                    </div>

                    <div className="col-6 col-lg-3">
                      <label className="form-label">Type</label>
                      <input
                        className="form-control"
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        placeholder="Boxing / Kettlebell / Bodyweight"
                      />
                    </div>

                    <div className="col-6 col-lg-3">
                      <label className="form-label">Equipment</label>
                      <input
                        className="form-control"
                        value={form.equipment}
                        onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                        placeholder="Kettlebell / Bodyweight"
                      />
                    </div>

                    <div className="col-12">
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
                        step="0.1"
                        value={form.met_value}
                        onChange={(e) => setForm({ ...form, met_value: e.target.value })}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Coaching cues, common faults, regressions…"
                      />
                    </div>

                    {/* Video preview (if embeddable) */}
                    {form.video_url?.startsWith("http") && (
                      <div className="col-12">
                        <div className="small text-dim mb-1">Preview</div>
                        <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden" }}>
                          <iframe
                            src={form.video_url}
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="Exercise video"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 d-flex gap-2">
                    <button className="btn btn-bxkr" onClick={saveExercise} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    {selectedId && (
                      <button className="btn btn-outline-danger" onClick={deleteExercise} disabled={deleting}>
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    )}
                  </div>

                  {/* Metadata */}
                  {selected && (
                    <div className="small text-dim mt-3">
                      <div>Created: {selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</div>
                      <div>Updated: {selected.updated_at ? new Date(selected.updated_at).toLocaleString() : "—"}</div>
                      <div>By: {selected.created_by || "—"}{selected.last_modified_by ? ` → ${selected.last_modified_by}` : ""}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}
