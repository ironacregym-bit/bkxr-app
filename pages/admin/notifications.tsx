
// pages/admin/notifications.tsx
"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useState } from "react";
import BottomNav from "../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

export default function AdminNotifications() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const { data, mutate } = useSWR(status === "authenticated" ? "/api/notify/templates/list" : null, fetcher);
  const templates = Array.isArray(data?.templates) ? data.templates : [];

  const [form, setForm] = useState<any>({
    key: "",
    enabled: true,
    title_template: "",
    body_template: "",
    url_template: "/",
    data_template: "{}",
    throttle_seconds: 0,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [testKey, setTestKey] = useState<string>("");
  const [testCtx, setTestCtx] = useState<string>('{}');
  const [busy, setBusy] = useState(false);

  if (status === "loading") return <div className="container py-4">Checking access…</div>;
  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <main className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
        <BottomNav />
      </main>
    );
  }

  async function saveTemplate() {
    setBusy(true); setMsg(null);
    try {
      const body = {
        ...form,
        data_template: JSON.parse(form.data_template || "{}"),
      };
      const res = await fetch("/api/notify/templates/save", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to save");
      setMsg("Template saved ✅"); mutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to save");
    } finally { setBusy(false); }
  }

  async function deleteTemplate(key: string) {
    if (!confirm(`Delete template "${key}"?`)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/notify/templates/delete", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to delete");
      setMsg("Template deleted ✅"); mutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete");
    } finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/notify/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: testKey,
          context: JSON.parse(testCtx || "{}"),
          // email omitted → current signed‑in user
          force: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to send");
      setMsg(`Sent: ${j.sent}, Failed: ${j.failed}`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to send");
    } finally { setBusy(false); }
  }

  function loadForEdit(t: any) {
    setForm({
      key: t.key,
      enabled: !!t.enabled,
      title_template: t.title_template || "",
      body_template: t.body_template || "",
      url_template: t.url_template || "/",
      data_template: JSON.stringify(t.data_template || {}, null, 2),
      throttle_seconds: Number(t.throttle_seconds ?? 0),
    });
  }

  return (
    <>
      <Head><title>Notifications • Admin</title></Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <h2 className="mb-3">Notifications</h2>
        {msg && <div className={`alert ${msg.includes("✅") ? "alert-success" : "alert-info"}`}>{msg}</div>}

        {/* List */}
        <section className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="fw-semibold">Templates</div>
            <button
              className="btn btn-sm" style={{ background: ACCENT, border: "none", borderRadius: 24, color: "#0b0f14" }}
              onClick={() => setForm({ key: "", enabled: true, title_template: "", body_template: "", url_template: "/", data_template: "{}", throttle_seconds: 0 })}
            >
              + New
            </button>
          </div>
          {templates.length === 0 ? (
            <div className="small text-muted">No templates yet.</div>
          ) : (
            <div className="row g-2">
              {templates.map((t: any) => (
                <div key={t.key} className="col-12 col-md-6">
                  <div className="card p-3" style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14 }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{t.key}</div>
                        <div className="small text-muted">{t.enabled ? "Enabled" : "Disabled"}</div>
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-outline-light" onClick={() => loadForEdit(t)} style={{ borderRadius: 20 }}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTemplate(t.key)} style={{ borderRadius: 20 }}>Delete</button>
                      </div>
                    </div>
                    <div className="small mt-2">
                      <div><strong>Title:</strong> {t.title_template}</div>
                      <div><strong>Body:</strong> {t.body_template}</div>
                      <div><strong>URL:</strong> {t.url_template || "/"}</div>
                      <div><strong>Throttle:</strong> {Number(t.throttle_seconds || 0)}s</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Edit/Create */}
        <section className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="fw-semibold mb-2">{form.key ? `Edit: ${form.key}` : "New template"}</div>
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label">Key</label>
              <input className="form-control" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="e.g., workout_completed" />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Enabled</label><br />
              <input type="checkbox" className="form-check-input" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">Throttle (secs)</label>
              <input type="number" className="form-control" value={form.throttle_seconds} onChange={(e) => setForm({ ...form, throttle_seconds: Number(e.target.value) || 0 })} />
            </div>
            <div className="col-12">
              <label className="form-label">Title template</label>
              <input className="form-control" value={form.title_template} onChange={(e) => setForm({ ...form, title_template: e.target.value })} placeholder="e.g., Nice work 🥊, {{user.name}}!" />
            </div>
            <div className="col-12">
              <label className="form-label">Body template</label>
              <input className="form-control" value={form.body_template} onChange={(e) => setForm({ ...form, body_template: e.target.value })} placeholder="e.g., You completed {{workout.name}}." />
            </div>
            <div className="col-12">
              <label className="form-label">URL template</label>
              <input className="form-control" value={form.url_template} onChange={(e) => setForm({ ...form, url_template: e.target.value })} placeholder="/workout/{{workout.id}}" />
            </div>
            <div className="col-12">
              <label className="form-label">Data template (JSON)</label>
              <textarea className="form-control" rows={4} value={form.data_template} onChange={(e) => setForm({ ...form, data_template: e.target.value })} placeholder='{"type":"workout_completion","workout_id":"{{workout.id}}"}' />
            </div>
          </div>
          <div className="mt-2">
            <button className="btn" onClick={saveTemplate} disabled={busy} style={{ background: ACCENT, border: "none", borderRadius: 24, color: "#0b0f14", fontWeight: 600 }}>
              {busy ? "Saving…" : "Save Template"}
            </button>
          </div>
        </section>

        {/* Test send */}
        <section className="bxkr-card p-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="fw-semibold mb-2">Send test</div>
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label">Template key</label>
              <input className="form-control" value={testKey} onChange={(e) => setTestKey(e.target.value)} placeholder="e.g., workout_completed" />
            </div>
            <div className="col-12 col-md-8">
              <label className="form-label">Context (JSON)</label>
              <textarea className="form-control" rows={4} value={testCtx} onChange={(e) => setTestCtx(e.target.value)} placeholder='{"user":{"name":"Rob"},"workout":{"id":"w1","name":"Benchmark Engine"}}' />
            </div>
          </div>
          <div className="mt-2">
            <button className="btn btn-outline-light" onClick={sendTest} disabled={busy} style={{ borderRadius: 24 }}>
              {busy ? "Sending…" : "Send test to me"}
            </button>
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
