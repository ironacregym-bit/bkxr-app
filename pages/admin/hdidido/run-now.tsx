
// pages/admin/hdidido/run-now.tsx
import Head from "next/head";
import { useState } from "react";

export default function HdididoRunNow() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function runNow() {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      // Calls server-side proxy that injects Authorization header
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

  return (
    <>
      <Head>
        <title>Run HowDidiDo Booking | BXKR</title>
      </Head>
      <main className="container py-3" style={{ color: "#fff" }}>
        <h1 className="h4 mb-3">Run HowDidiDo Booking</h1>

        <div
          className="card p-3"
          style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12 }}
        >
          <p className="mb-2">
            Hard‑coded test: <strong>Sunday 18th Jan 2026 @ 06:00</strong><br />
            User: <strong>ben.jones1974@hotmail.co.uk</strong>
          </p>
          <button
            className="btn btn-primary"
            onClick={runNow}
            disabled={running}
          >
            {running ? "Running…" : "Run booking now"}
          </button>
        </div>

        {error && (
          <div className="alert alert-danger mt-3">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="alert alert-success mt-3">
            <strong>Result:</strong>{" "}
            {typeof result === "string"
              ? result
              : JSON.stringify(result)}
          </div>
        )}
      </main>
    </>
  );
}
