
// pages/admin/notifications.tsx
"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

// Helper: pretty JSON
const pretty = (obj: any) => JSON.stringify(obj ?? {}, null, 2);

export default function AdminNotifications() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  const { data: tplResp, mutate: tplMutate } = useSWR(
    status === "authenticated" ? "/api/notify/templates/list" : null,
    fetcher
  );
  const templates = Array.isArray(tplResp?.templates) ? tplResp.templates : [];

  const { data: ruleResp, mutate: ruleMutate } = useSWR(
    status === "authenticated" ? "/api/notify/rules/list" : null,
    fetcher
  );
  const rules = Array.isArray(ruleResp?.rules) ? ruleResp.rules : [];

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Template form
  const [tplForm, setTplForm] = useState<any>({
    key: "",
    enabled: true,
    title_template: "",
    body_template: "",
    url_template: "/",
    data_template: "{}",
    throttle_seconds: 0,
    channels: ["in_app"], // optional: ["in_app","push"]
  });

  // Rule form
  const [ruleForm, setRuleForm] = useState<any>({
    key: "",
    enabled: true,
    event: "onboarding_incomplete",
    priority: 100,
    channels: ["in_app"], // ["in_app","push"]
    throttle_seconds: 0,
    condition: pretty({ onboarding_complete: false }),
    title_template: "Finish setting up BXKR",
    body_template: "Two minutes to go — unlock tailored workouts now.",
    url_template: "/onboarding",
    data_template: "{}",
  });

  // Test send (template)
  const [testKey, setTestKey] = useState<string>("");
  const [testCtx, setTestCtx] = useState<string>('{"user":{"name":"Rob"}}');

  // Emit event (rule engine)
  const [emitEvent, setEmitEvent] = useState<string>("onboarding_incomplete");
  const [emitCtx, setEmitCtx] = useState<string>('{}');

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

  /* ------------ TEMPLATE ACTIONS ------------ */
  async function saveTemplate() {
    setBusy(true); setMsg(null);
    try {
      const body = {
        ...tplForm,
        data_template: JSON.parse(tplForm.data_template || "{}"),
      };
      const res = await fetch("/api/notify/templates/save", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to save");
      setMsg("Template saved ✅"); tplMutate();
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
      setMsg("Template deleted ✅"); tplMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete");
    } finally { setBusy(false); }
  }

  function loadTplForEdit(t: any) {
    setTplForm({
      key: t.key,
      enabled: !!t.enabled,
      title_template: t.title_template || "",
      body_template: t.body_template || "",
      url_template: t.url_template || "/",
      data_template: pretty(t.data_template || {}),
      throttle_seconds: Number(t.throttle_seconds ?? 0),
      channels: Array.isArray(t.channels) ? t.channels : ["in_app"],
    });
  }

  async function sendTestTemplate() {
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

  /* ------------ RULE ACTIONS ------------ */
  async function saveRule() {
    setBusy(true); setMsg(null);
    try {
      const body = {
        ...ruleForm,
        condition: JSON.parse(ruleForm.condition || "{}"),
        data_template: JSON.parse(ruleForm.data_template || "{}"),
      };
      const res = await fetch("/api/notify/rules/save", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to save rule");
      setMsg("Rule saved ✅"); ruleMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to save rule");
    } finally { setBusy(false); }
  }

  async function deleteRule(key: string) {
    if (!confirm(`Delete rule "${key}"?`)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/notify/rules/delete", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to delete rule");
      setMsg("Rule deleted ✅"); ruleMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete rule");
    } finally { setBusy(false); }
  }

  function loadRuleForEdit(r: any) {
    setRuleForm({
      key: r.key,
      enabled: !!r.enabled,
      event: r.event || "onboarding_incomplete",
      priority: Number(r.priority ?? 100),
      channels: Array.isArray(r.channels) ? r.channels : ["in_app"],
      throttle_seconds: Number(r.throttle_seconds ?? 0),
      condition: pretty(r.condition || {}),
      title_template: r.title_template || "",
      body_template: r.body_template || "",
      url_template: r.url_template || "/",
      data_template: pretty(r.data_template || {}),
    });
  }

  async function emitEventNow() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/notify/emit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: emitEvent,
          context: JSON.parse(emitCtx || "{}"),
          // email omitted → current signed‑in user
          force: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to emit");
      setMsg(`Emitted: ${j.emitted} notification(s)`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to emit");
    } finally { setBusy(false); }
  }

  const accentBtn = useMemo(
    () => ({ background: ACCENT, border: "none", borderRadius: 24, color: "#0b0f14", fontWeight: 600 }),
    []
  );

  return (
    <>
      <Head><title>Notifications • Admin</title></Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <h2 className="mb-3">Notifications</h2>
        {msg && <div className={`alert ${msg.includes("✅") ? "alert-success" : "alert-info"}`}>{msg}</div>}

        {/* Templates List */}
        <section className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="fw-semibold">Templates</div>
            <button
              className="btn btn-sm" style={accentBtn}
              onClick={() => setTplForm({ key: "", enabled: true, title_template: "", body_template: "", url_template: "/", data_template: "{}", throttle_seconds: 0, channels: ["in_app"] })}
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
                        <button className="btn btn-sm btn-outline-light" onClick={() => loadTplForEdit(t)} style={{ borderRadius: 20 }}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTemplate(t.key)} style={{ borderRadius: 20 }}>Delete</button>
                      </div>
                    </div>
                    <div className="small mt-2">
                      <div><strong>Title:</strong> {t.title_template}</div>
                      <div><strong>Body:</strong> {t.body_template}</div>
                      <div><strong>URL:</strong> {t.url_template || "/"}</div>
                      <div><strong>Channels:</strong> {Array.isArray(t.channels) ? t.channels.join(", ") : "in_app"}</div>
                      <div><strong>Throttle:</strong> {Number(t.throttle_seconds || 0)}s</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Template Edit/Create */}
        <section className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="fw-semibold mb-2">{tplForm.key ? `Edit: ${tplForm.key}` : "New template"}</div>
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label">Key</label>
              <input className="form-control" value={tplForm.key} onChange={(e) => setTplForm({ ...tplForm, key: e.target.value })} placeholder="e.g., workout_completed" />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">Enabled</label><br />
              <input type="checkbox" className="form-check-input" checked={!!tplForm.enabled} onChange={(e) => setTplForm({ ...tplForm, enabled: e.target.checked })} />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">Throttle (secs)</label>
              <input type="number" className="form-control" value={tplForm.throttle_seconds} onChange={(e) => setTplForm({ ...tplForm, throttle_seconds: Number(e.target.value) || 0 })} />
            </div>
            <div className="col-12">
              <label className="form-label">Channels (comma)</label>
              <input className="form-control" value={Array.isArray(tplForm.channels) ? tplForm.channels.join(",") : ""} onChange={(e) => setTplForm({ ...tplForm, channels: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="in_app,push" />
            </div>
            <div className="col-12">
              <label className="form-label">Title template</label>
              <input className="form-control" value={tplForm.title_template} onChange={(e) => setTplForm({ ...tplForm, title_template: e.target.value })} placeholder="e.g., Nice work 🥊, {{user.name}}!" />
            </div>
            <div className="col-12">
              <label className="form-label">Body template</label>
              <input className="form-control" value={tplForm.body_template} onChange={(e) => setTplForm({ ...tplForm, body_template: e.target.value })} placeholder="e.g., You completed {{workout.name}}." />
            </div>
            <div className="col-12">
              <label className="form-label">URL template</label>
              <input className="form-control" value={tplForm.url_template} onChange={(e) => setTplForm({ ...tplForm, url_template: e.target.value })} placeholder="/workout/{{workout.id}}" />
            </div>
            <div className="col-12">
              <label className="form-label">Data template (JSON)</label>
              <textarea className="form-control" rows={4} value={tplForm.data_template} onChange={(e) => setTplForm({ ...tplForm, data_template: e.target.value })} placeholder='{"type":"workout_completion","workout_id":"{{workout.id}}"}' />
            </div>
          </div>
          <div className="mt-2">
            <button className="btn" onClick={saveTemplate} disabled={busy} style={accentBtn}>
              {busy ? "Saving…" : "Save Template"}
            </button>
          </div>
        </section>

        {/* Rules List */}
        <section className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="fw-semibold">Rules</div>
            <button
              className="btn btn-sm" style={accentBtn}
              onClick={() => setRuleForm({
                key: "", enabled: true, event: "onboarding_incomplete", priority: 100, channels: ["in_app"],
                throttle_seconds: 0, condition: pretty({ onboarding_complete: false }),
                title_template: "Finish setting up BXKR",
                body_template: "Two minutes to go — unlock tailored workouts now.",
                url_template: "/onboarding",
                data_template: "{}",
              })}
            >
              + New
            </button>
          </div>
          {rules.length === 0 ? (
            <div className="small text-muted">No rules yet.</div>
          ) : (
            <div className="row g-2">
              {rules.map((r: any) => (
                <div key={r.key} className="col-12 col-md-6">
                  <div className="card p-3" style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14 }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{r.key}</div>
                        <div className="small text-muted">{r.enabled ? "Enabled" : "Disabled"} • {r.event}</div>
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-outline-light" onClick={() => loadRuleForEdit(r)} style={{ borderRadius: 20 }}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteRule(r.key)} style={{ borderRadius: 20 }}>Delete</button>
                      </div>
                    </div>
                    <div className="small mt-2">
                      <div><strong>Condition:</strong> {JSON.stringify(r.condition)}</div>
                      <div><strong>Channels:</strong> {Array.isArray(r.channels) ? r.channels.join(", ") : "in_app"}</div>
                      <div><strong>Throttle:</strong> {Number(r.throttle_seconds || 0)}s • <strong>Priority:</strong> {Number(r.priority || 0)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Rule Edit/Create */}
        <section className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="fw-semibold mb-2">{ruleForm.key ? `Edit rule: ${ruleForm.key}` : "New rule"}</div>
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label">Key</label>
              <input className="form-control" value={ruleForm.key} onChange={(e) => setRuleForm({ ...ruleForm, key: e.target.value })} placeholder="e.g., onboarding_incomplete_nudge" />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Event</label>
              <input className="form-control" value={ruleForm.event} onChange={(e) => setRuleForm({ ...ruleForm, event: e.target.value })} placeholder="e.g., onboarding_incomplete" />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Enabled</label><br />
              <input type="checkbox" className="form-check-input" checked={!!ruleForm.enabled} onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })} />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label">Priority</label>
              <input type="number" className="form-control" value={ruleForm.priority} onChange={(e) => setRuleForm({ ...ruleForm, priority: Number(e.target.value) || 0 })} />
            </div>

            <div className="col-12">
              <label className="form-label">Channels (comma)</label>
              <input className="form-control" value={Array.isArray(ruleForm.channels) ? ruleForm.channels.join(",") : ""} onChange={(e) => setRuleForm({ ...ruleForm, channels: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="in_app,push" />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label">Throttle (secs)</label>
              <input type="number" className="form-control" value={ruleForm.throttle_seconds} onChange={(e) => setRuleForm({ ...ruleForm, throttle_seconds: Number(e.target.value) || 0 })} />
            </div>

            <div className="col-12">
              <label className="form-label">Condition (JSON)</label>
              <textarea className="form-control" rows={4} value={ruleForm.condition} onChange={(e) => setRuleForm({ ...ruleForm, condition: e.target.value })} placeholder='{"onboarding_complete": false}' />
            </div>

            <div className="col-12">
              <label className="form-label">Title template</label>
              <input className="form-control" value={ruleForm.title_template} onChange={(e) => setRuleForm({ ...ruleForm, title_template: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="form-label">Body template</label>
              <input className="form-control" value={ruleForm.body_template} onChange={(e) => setRuleForm({ ...ruleForm, body_template: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="form-label">URL template</label>
              <input className="form-control" value={ruleForm.url_template} onChange={(e) => setRuleForm({ ...ruleForm, url_template: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="form-label">Data template (JSON)</label>
              <textarea className="form-control" rows={4} value={ruleForm.data_template} onChange={(e) => setRuleForm({ ...ruleForm, data_template: e.target.value })} />
            </div>
          </div>

          <div className="mt-2">
            <button className="btn" onClick={saveRule} disabled={busy} style={accentBtn}>
              {busy ? "Saving…" : "Save Rule"}
            </button>
          </div>
        </section>

        {/* Emit Event (Rule engine) */}
        <section className="bxkr-card p-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="fw-semibold mb-2">Emit event</div>
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label">Event</label>
              <input className="form-control" value={emitEvent} onChange={(e) => setEmitEvent(e.target.value)} placeholder="e.g., onboarding_incomplete, check_in_created" />
            </div>
            <div className="col-12 col-md-8">
              <label className="form-label">Context (JSON)</label>
              <textarea className="form-control" rows={4} value={emitCtx} onChange={(e) => setEmitCtx(e.target.value)} placeholder='{"recommended_focus":"KB hinge flow"}' />
            </div>
          </div>
          <div className="mt-2 d-flex gap-2">
            <button className="btn" onClick={emitEventNow} disabled={busy} style={accentBtn}>
              {busy ? "Emitting…" : "Emit for me"}
            </button>
          </div>
        </section>

        {/* Test send for template */}
        <section className="bxkr-card p-3 mt-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="fw-semibold mb-2">Send test (template)</div>
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
            <button className="btn btn-outline-light" onClick={sendTestTemplate} disabled={busy} style={{ borderRadius: 24 }}>
              {busy ? "Sending…" : "Send test to me"}
            </button>
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
