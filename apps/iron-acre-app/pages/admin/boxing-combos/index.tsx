// pages/admin/boxing-combos/index.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";

type PunchCode =
  | "jab"
  | "cross"
  | "lead hook"
  | "rear hook"
  | "lead uppercut"
  | "rear uppercut"
  | "hook"
  | "uppercut";

type DefenceCode = "slip" | "roll" | "parry" | "duck";

type BoxingAction =
  | { kind: "punch"; code: PunchCode }
  | { kind: "defence"; code: DefenceCode };

type BoxingCombo = {
  id: string;
  combo_name: string;
  category: "Basics" | "Speed" | "Power" | "Defensive" | "Engine";
  difficulty?: number | null;
  video_url?: string;
  notes?: string;
  actions: BoxingAction[];
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  last_modified_by?: string | null;
};

type ListResp = { combos: BoxingCombo[]; nextCursor?: string | null };

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

function actionToLabel(a: any): string {
  if (!a) return "";
  if (typeof a === "string") return a;
  if (typeof a === "object" && typeof a.code === "string") return a.code;
  return "";
}

export default function AdminBoxingCombosManager() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<"" | BoxingCombo["category"]>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileEditing, setMobileEditing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [showImporter, setShowImporter] = useState(false);
  const [importJson, setImportJson] = useState<string>("");
  const [importing, setImporting] = useState(false);

  const listKey = useMemo(() => {
    if (!mounted || status === "loading") return null;
    const isAllowed = !!session && (role === "admin" || role === "gym");
    if (!isAllowed) return null;

    const qs = new URLSearchParams();
    if (query.trim()) qs.set("q", query.trim());
    if (filterCategory) qs.set("category", filterCategory);
    qs.set("limit", "300");

    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return `/api/boxing-combos${suffix}`;
  }, [mounted, status, session, role, query, filterCategory]);

  const { data: listData, mutate: mutateList } = useSWR<ListResp>(listKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items = Array.isArray(listData?.combos) ? listData!.combos : [];

  const getKey = useMemo(() => {
    if (!mounted || status === "loading" || !selectedId) return null;
    const isAllowed = !!session && (role === "admin" || role === "gym");
    if (!isAllowed) return null;
    return `/api/boxing-combos/get?id=${encodeURIComponent(selectedId)}`;
  }, [mounted, status, session, role, selectedId]);

  const { data: selectedData, mutate: mutateSelected } = useSWR<{ combo?: BoxingCombo }>(getKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  });

  const selected = selectedData?.combo || null;

  const [form, setForm] = useState({
    combo_name: "",
    category: "Basics" as BoxingCombo["category"],
    difficulty: "" as string | number,
    video_url: "",
    notes: "",
    actionsJson: `[
  { "kind": "punch", "code": "jab" },
  { "kind": "punch", "code": "cross" }
]`,
  });

  useEffect(() => {
    if (!selected) return;
    setForm({
      combo_name: selected.combo_name || "",
      category: selected.category || "Basics",
      difficulty: selected.difficulty != null ? selected.difficulty : "",
      video_url: selected.video_url || "",
      notes: selected.notes || "",
      actionsJson: JSON.stringify(selected.actions || [], null, 2),
    });
  }, [selected]);

  function newCombo() {
    setSelectedId(null);
    setForm({
      combo_name: "",
      category: "Basics",
      difficulty: "",
      video_url: "",
      notes: "",
      actionsJson: `[
  { "kind": "punch", "code": "jab" },
  { "kind": "punch", "code": "cross" }
]`,
    });
    setMobileEditing(true);
    setMsg(null);
  }

  function parseActionsOrThrow(raw: string): BoxingAction[] {
    let actions: any;
    try {
      actions = JSON.parse(raw);
    } catch {
      throw new Error("Actions must be valid JSON array.");
    }
    if (!Array.isArray(actions) || actions.length < 1) throw new Error("Actions must be a non-empty array.");
    if (actions.length > 5) throw new Error("Max 5 actions per combo.");

    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      if (!a?.kind || !["punch", "defence"].includes(a.kind)) {
        throw new Error(`Invalid kind at actions[${i}]. Use 'punch' or 'defence'.`);
      }
      if (!a?.code || typeof a.code !== "string") {
        throw new Error(`Missing code at actions[${i}].`);
      }
    }
    return actions as BoxingAction[];
  }

  async function saveCombo() {
    setSaving(true);
    setMsg(null);

    try {
      const combo_name = String(form.combo_name || "").trim();
      if (!combo_name) {
        setMsg("Combo name is required (it becomes the ID by default).");
        setSaving(false);
        return;
      }

      const actions = parseActionsOrThrow(form.actionsJson);

      const payload = {
        id: selectedId || undefined,
        combo_name,
        category: form.category,
        difficulty: form.difficulty === "" ? null : Number(form.difficulty),
        video_url: String(form.video_url || "").trim(),
        notes: String(form.notes || "").trim(),
        actions,
      };

      const res = await fetch("/api/boxing-combos/create?upsert=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to save combo");

      setMsg(selectedId ? "Saved changes ✅" : "Combo created ✅");
      mutateList();

      if (j?.combo_id) {
        setSelectedId(j.combo_id);
        mutateSelected();
      }

      setMobileEditing(false);
    } catch (e: any) {
      setMsg(e?.message || "Failed to save combo");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCombo() {
    if (!selectedId) return;
    if (!confirm("Delete this combo? This cannot be undone.")) return;

    setDeleting(true);
    setMsg(null);

    try {
      const res = await fetch(`/api/boxing-combos/delete?id=${encodeURIComponent(selectedId)}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to delete combo");

      setMsg("Combo deleted 🗑️");
      setSelectedId(null);
      mutateList();
      setMobileEditing(false);

      setForm({
        combo_name: "",
        category: "Basics",
        difficulty: "",
        video_url: "",
        notes: "",
        actionsJson: `[
  { "kind": "punch", "code": "jab" },
  { "kind": "punch", "code": "cross" }
]`,
      });
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete combo");
    } finally {
      setDeleting(false);
    }
  }

  async function importCombosJson() {
    setImporting(true);
    setMsg(null);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(importJson);
      } catch {
        throw new Error("Invalid JSON. Paste an array or { combos: [...] }.");
      }

      const res = await fetch("/api/boxing-combos/bulk-create?upsert=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Import failed");

      const written = Array.isArray(j?.written) ? j.written.length : 0;
      const failures = Array.isArray(j?.failures) ? j.failures.length : 0;
      setMsg(`Imported ✅ Written: ${written}. Failures: ${failures}.`);
      mutateList();
      setShowImporter(false);
      setImportJson("");
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "Import failed"}`);
    } finally {
      setImporting(false);
    }
  }

  const isAllowed = !!session && (role === "admin" || role === "gym");

  return (
    <>
      <Head><title>Boxing Combos • Admin</title></Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        {(!mounted || status === "loading") && <div className="py-4">Checking access…</div>}

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
                <h2 className="m-0">Boxing Combos</h2>
              </div>

              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-light"
                  onClick={() => setShowImporter((v) => !v)}
                  style={{ borderRadius: 24 }}
                >
                  {showImporter ? "Close Import" : "Import JSON"}
                </button>

                <button className="btn btn-bxkr d-none d-md-inline" onClick={newCombo}>
                  <i className="fas fa-plus me-2" /> New
                </button>

                <div className="d-md-none">
                  <button className="btn btn-bxkr" onClick={newCombo}>
                    <i className="fas fa-plus me-2" /> Create
                  </button>
                </div>
              </div>
            </div>

            {msg && (
              <div
                className={`alert ${
                  msg.toLowerCase().includes("failed") || msg.toLowerCase().startsWith("error")
                    ? "alert-danger"
                    : "alert-success"
                }`}
              >
                {msg}
              </div>
            )}

            {showImporter && (
              <section
                className="mb-3"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 16,
                  padding: 16,
                  backdropFilter: "blur(10px)",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h5 className="m-0">Import Boxing Combos (JSON)</h5>
                  <button
                    className="btn btn-bxkr"
                    onClick={importCombosJson}
                    disabled={importing || !importJson.trim()}
                    style={{ borderRadius: 24 }}
                  >
                    {importing ? "Importing…" : "Import"}
                  </button>
                </div>

                <div className="small text-dim mb-2">
                  Paste an array of combos or <code>{`{ "combos": [...] }`}</code>. Each combo must include combo_name, category, and actions (1–5).
                </div>

                <textarea
                  className="form-control"
                  rows={12}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder={`[
  {
    "combo_name": "2-S-2-D",
    "category": "Defensive",
    "video_url": "",
    "difficulty": 2,
    "notes": "",
    "actions": [
      { "kind": "punch", "code": "cross" },
      { "kind": "defence", "code": "slip" },
      { "kind": "punch", "code": "cross" },
      { "kind": "defence", "code": "duck" }
    ]
  }
]`}
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                />
              </section>
            )}

            <div className="row gx-3">
              <div className={`col-12 col-md-4 ${mobileEditing ? "d-none d-md-block" : ""}`}>
                <div className="futuristic-card p-3">
                  <div className="d-flex gap-2 mb-2">
                    <input
                      className="form-control"
                      placeholder="Search combo name…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className="btn btn-outline-light" onClick={() => setQuery("")}>
                      <i className="fas fa-times" />
                    </button>
                  </div>

                  <div className="d-flex gap-2 mb-2">
                    <select
                      className="form-select"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value as any)}
                    >
                      <option value="">Category: All</option>
                      <option value="Basics">Basics</option>
                      <option value="Speed">Speed</option>
                      <option value="Power">Power</option>
                      <option value="Defensive">Defensive</option>
                      <option value="Engine">Engine</option>
                    </select>
                  </div>

                  <div style={{ maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
                    {!items.length ? (
                      <div className="text-muted">No combos found.</div>
                    ) : (
                      <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
                        {items.map((c) => {
                          const active = selectedId === c.id;
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedId(c.id);
                                  setMobileEditing(true);
                                  setMsg(null);
                                }}
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
                                <div className="d-flex justify-content-between align-items-center">
                                  <div className="fw-semibold">{c.combo_name}</div>
                                  <span className="badge" style={{ background: ACCENT, color: "#0b0f14" }}>
                                    {c.category}
                                  </span>
                                </div>
                                <div className="small text-dim">
                                  {(c.actions || []).map(actionToLabel).filter(Boolean).join(" - ")}
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

              <div className={`col-12 col-md-8 ${mobileEditing ? "" : "d-none d-md-block"}`}>
                <div className="futuristic-card p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="m-0">{selectedId ? "Edit combo" : "Create combo"}</h5>
                    <div className="d-md-none">
                      <button className="btn btn-outline-light btn-sm" onClick={() => setMobileEditing(false)}>
                        <i className="fas fa-chevron-left me-2" /> Back to list
                      </button>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-12 col-lg-6">
                      <label className="form-label">Combo name (also ID)</label>
                      <input
                        className="form-control"
                        value={form.combo_name}
                        onChange={(e) => setForm({ ...form, combo_name: e.target.value })}
                        placeholder="e.g., 2-S-2-D"
                      />
                    </div>

                    <div className="col-6 col-lg-3">
                      <label className="form-label">Category</label>
                      <select
                        className="form-select"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                      >
                        <option value="Basics">Basics</option>
                        <option value="Speed">Speed</option>
                        <option value="Power">Power</option>
                        <option value="Defensive">Defensive</option>
                        <option value="Engine">Engine</option>
                      </select>
                    </div>

                    <div className="col-6 col-lg-3">
                      <label className="form-label">Difficulty (1–5)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        max={5}
                        step={1}
                        value={form.difficulty}
                        onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Video URL (optional)</label>
                      <input
                        className="form-control"
                        value={form.video_url}
                        onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                        placeholder="https://…"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Notes (optional)</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Coaching cues, intent, constraints…"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Actions (JSON array, max 5)</label>
                      <textarea
                        className="form-control"
                        rows={10}
                        value={form.actionsJson}
                        onChange={(e) => setForm({ ...form, actionsJson: e.target.value })}
                        placeholder='[{"kind":"punch","code":"cross"},{"kind":"defence","code":"slip"}]'
                      />
                      <div className="small text-dim mt-1">
                        Example codes: jab, cross, lead hook, rear hook, lead uppercut, rear uppercut, slip, roll, parry, duck
                      </div>
                    </div>

                    {form.video_url?.startsWith("http") && (
                      <div className="col-12">
                        <div className="small text-dim mb-1">Video</div>
                        <a
                          href={form.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline-light"
                          style={{ borderRadius: 24 }}
                        >
                          Watch video
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 d-flex gap-2">
                    <button className="btn btn-bxkr" onClick={saveCombo} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    {selectedId && (
                      <button className="btn btn-outline-danger" onClick={deleteCombo} disabled={deleting}>
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    )}
                  </div>

                  {selected && (
                    <div className="small text-dim mt-3">
                      <div>Created: {selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</div>
                      <div>Updated: {selected.updated_at ? new Date(selected.updated_at).toLocaleString() : "—"}</div>
                      <div>
                        By: {selected.created_by || "—"}
                        {selected.last_modified_by ? ` → ${selected.last_modified_by}` : ""}
                      </div>
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
