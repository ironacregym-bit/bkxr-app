
import Head from "next/head";
import { useState } from "react";

export default function HdididoRunNow() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function runNow() {
    setRunning(true); setError(null); setResult(null);
    try {
      // Calls a tiny server-side proxy that adds Authorization header
      const r = await fetch("/api/integrations/hdidido/run-now-proxy");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Runner failed");
      setResult(j);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  async function queueQuickJob() {
    setRunning(true); setError(null); setResult(null);
    try {
      const nowPlus60 = new Date(Date.now() + 60_000).toISOString();
      const payload = {
        requester_email: "ironacregym@gmail.com",
        booking_type: "casual",
        club_name: "Ipswich GC",
        target_date: new Date().toISOString().slice(0,10),
        target_time: "07:59",
        time_window_secs: 45,
        members: [{ full_name: "Rob Laing", club_id: "123456" }],
        run_at: nowPlus60,
        notes: "Manual test via Run Now page"
      };
      const r = await fetch("/api/integrations/hdidido/queue", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Queue failed");
      setResult(j);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Head><title>Run HowDidiDo Runner | BXKR</title></Head>
      <main className="container py-3" style={{ color: "#fff" }}>
        <h1 className="h4 mb-3">Run HowDidiDo Runner</h1>
        <div className="card p-3" style={{ background:"rgba(255,255,255,0.06)", borderRadius:12 }}>
          <p className="mb-2">Kick the runner once, or queue a quick test job for ~60s from now.</p>
          <div className="d-flex gap-2">
            <button className="btn btn-primary" onClick={runNow} disabled={running}>
              {running ? "Running…" : "Run now (once)"}
            </button>
            <button className="btn btn-light" onClick={queueQuickJob} disabled={running}>
              {running ? "Queueing…" : "Queue test job (+60s)"}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger mt-3">Error: {error}</div>}
        {result && (
          <div className="alert alert-success mt-3">
            <div className="mb-1"><strong>Result:</strong> {typeof result === "string" ? result : JSON.stringify(result)}</div>
          </div>
        )}
      </main>
    </>
  );
}
