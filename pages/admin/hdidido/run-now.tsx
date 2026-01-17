
// pages/admin/hdidido/run-now.tsx
import Head from "next/head";
import { useState } from "react";

export default function HdididoRunNow() {
  const [runningRunner, setRunningRunner] = useState(false);
  const [runnerResult, setRunnerResult] = useState<any>(null);
  const [runnerError, setRunnerError] = useState<string | null>(null);

  const [runningProbe, setRunningProbe] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  async function runRunner() {
    setRunningRunner(true);
    setRunnerError(null);
    setRunnerResult(null);
    try {
      // Calls your runner API directly (no -proxy)
      const r = await fetch("/api/integrations/hdidido/runner", {
        method: "GET",
      });
      const j = await safeJson(r);
      if (!r.ok) throw new Error(j?.error || "Runner failed");
      setRunnerResult(j);
    } catch (e: any) {
      setRunnerError(e?.message || "Unknown error");
    } finally {
      setRunningRunner(false);
    }
  }

  async function runProbe() {
    setRunningProbe(true);
    setProbeError(null);
    setProbeResult(null);
    try {
      // Calls your probe API directly (no -proxy)
      const r = await fetch("/api/integrations/hdidido/probe", {
        method: "GET",
      });
      const j = await safeJson(r);
      if (!r.ok) throw new Error(j?.error || "Probe failed");
      setProbeResult(j);
    } catch (e: any) {
      setProbeError(e?.message || "Unknown error");
    } finally {
      setRunningProbe(false);
    }
  }

  // Utility: tolerate non-JSON error bodies gracefully
  async function safeJson(r: Response) {
    try {
      return await r.json();
    } catch {
      return { ok: r.ok, status: r.status, text: await r.text().catch(() => "") };
    }
  }

  return (
    <>
      <Head>
        <title>HowDidiDo Tools | BXKR</title>
      </Head>
      <main className="container py-3" style={{ color: "#fff" }}>
        <h1 className="h4 mb-3">HowDidiDo tools</h1>

        {/* Runner card */}
        <div
          className="card p-3 mb-3"
          style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12 }}
        >
          <p className="mb-2">
            <strong>Runner</strong> — full flow: Login → TeeSheet (date) → Book → BookingAdd → Confirm
            <br />
            Target: <strong>Sun 18 Jan 2026 @ 06:00</strong> • CourseId <strong>12274</strong>
          </p>
          <button
            className="btn btn-primary me-2"
            onClick={runRunner}
            disabled={runningRunner}
          >
            {runningRunner ? "Running…" : "Run booking now"}
          </button>

          {runnerError && (
            <div className="alert alert-danger mt-3" role="alert">
              <strong>Error:</strong> {runnerError}
            </div>
          )}

          {runnerResult && (
            <div className="alert alert-success mt-3" style={{ wordBreak: "break-word" }} role="status">
              <strong>Result:</strong>{" "}
              {typeof runnerResult === "string"
                ? runnerResult
                : JSON.stringify(runnerResult)}
            </div>
          )}
        </div>

        {/* Probe card */}
        <div
          className="card p-3"
          style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12 }}
        >
          <p className="mb-2">
            <strong>Probe</strong> — diagnostic only: opens the exact TeeSheet date URL with token and
            returns the resulting URL, HTTP status, title, body sample, and a screenshot reference.
            <br />
            Target: <strong>Sun 18 Jan 2026</strong> • CourseId <strong>12274</strong>
          </p>
          <button
            className="btn btn-outline-light"
            onClick={runProbe}
            disabled={runningProbe}
          >
            {runningProbe ? "Probing…" : "Run probe now"}
          </button>

          {probeError && (
            <div className="alert alert-danger mt-3" role="alert">
              <strong>Error:</strong> {probeError}
            </div>
          )}

          {probeResult && (
            <div className="alert alert-success mt-3" style={{ wordBreak: "break-word" }} role="status">
              <strong>Result:</strong>{" "}
              {typeof probeResult === "string"
                ? probeResult
                : JSON.stringify(probeResult)}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
