
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
    channels: ["in_app"],
  });

  // Rule form (✅ expiry supported)
  const [ruleForm, setRuleForm] = useState<any>({
    key: "",
    enabled: true,
    event: "onboarding_incomplete",
    priority: 100,
    channels: ["in_app"],
    throttle_seconds: 0,
    expires_in_hours: 24,
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
    setBusy(true);
    setMsg(null);
    try {
      const body = { ...tplForm, data_template: JSON.parse(tplForm.data_template || "{}") };
      const res = await fetch("/api/notify/templates/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to save");
      setMsg("Template saved ✅");
      tplMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate(key: string) {
    if (!confirm(`Delete template "${key}"?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/notify/templates/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to delete");
      setMsg("Template deleted ✅");
      tplMutate();
    } finally {
      setBusy(false);
    }
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
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/notify/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: testKey,
          context: JSON.parse(testCtx || "{}"),
          force: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to send");
      setMsg(`Sent: ${j.sent}, Failed: ${j.failed}`);
    } finally {
      setBusy(false);
    }
  }

  /* ------------ RULE ACTIONS ------------ */
  async function saveRule() {
    setBusy(true);
    setMsg(null);
    try {
      const body = {
        ...ruleForm,
        condition: JSON.parse(ruleForm.condition || "{}"),
        data_template: JSON.parse(ruleForm.data_template || "{}"),
      };
      const res = await fetch("/api/notify/rules/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to save rule");
      setMsg("Rule saved ✅");
      ruleMutate();
    } finally {
      setBusy(false);
    }
  }

  async function deleteRule(key: string) {
    if (!confirm(`Delete rule "${key}"?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/notify/rules/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to delete rule");
      setMsg("Rule deleted ✅");
      ruleMutate();
    } finally {
      setBusy(false);
    }
  }

  function loadRuleForEdit(r: any) {
    setRuleForm({
      key: r.key,
      enabled: !!r.enabled,
      event: r.event || "onboarding_incomplete",
      priority: Number(r.priority ?? 100),
      channels: Array.isArray(r.channels) ? r.channels : ["in_app"],
      throttle_seconds: Number(r.throttle_seconds ?? 0),
      expires_in_hours: Number(r.expires_in_hours ?? 0),
      condition: pretty(r.condition || {}),
      title_template: r.title_template || "",
      body_template: r.body_template || "",
      url_template: r.url_template || "/",
      data_template: pretty(r.data_template || {}),
    });
  }

  async function emitEventNow() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/notify/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: emitEvent,
          context: JSON.parse(emitCtx || "{}"),
          force: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed");
      setMsg(`Emitted: ${j.emitted} notification(s)`);
    } finally {
      setBusy(false);
    }
  }

  const accentBtn = useMemo(
    () => ({ background: ACCENT, border: "none", borderRadius: 24, color: "#0b0f14", fontWeight: 600 }),
    []
  );

  // ---------- UI RENDER ----------
  return (
    <>
      <Head><title>Notifications • Admin</title></Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <h2 className="mb-3">Notifications</h2>
        {msg && <div className={`alert ${msg.includes("✅") ? "alert-success" : "alert-info"}`}>{msg}</div>}

        {/* Rule Edit/Create */}
        <section className="bxkr-card p-3 mb-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="fw-semibold mb-2">{ruleForm.key ? `Edit rule: ${ruleForm.key}` : "New rule"}</div>
          <div className="row g-2">

            {/* Expiry */}
            <div className="col-12 col-md-4">
              <label className="form-label">Expires (hours)</label>
              <input
                type="number"
                min={0}
                className="form-control"
                value={Number(ruleForm.expires_in_hours || 0)}
                onChange={(e) => setRuleForm({ ...ruleForm, expires_in_hours: Number(e.target.value) || 0 })}
              />
              <div className="form-text text-muted">
                0 = never expires • 24 = 1 day • 48 = mid‑week
              </div>
            </div>

          </div>

          <div className="mt-2">
            <button className="btn" onClick={saveRule} disabled={busy} style={accentBtn}>
              {busy ? "Saving…" : "Save Rule"}
            </button>
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
