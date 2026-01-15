
// pages/admin/hdidido/queue.tsx
import { useState } from "react";
import Head from "next/head";
import { useSession } from "next-auth/react";

// If you created lib/crypto.ts as in Step 1, we can import a safe symmetric encryptor.
// If you haven't yet, comment out these imports + the usage below, or keep creds empty.
let encryptJson: ((obj: unknown) => string) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  encryptJson = require("../../../lib/crypto").encryptJson as (obj: unknown) => string;
} catch {
  // crypto not available on client by default; we are conditionally using it via API if present.
  // It's safe to proceed without creds encryption if you're not passing credentials.
}

type Member = { full_name: string; club_id?: string; hdidido_email?: string };

export default function HdididoQueueAdmin() {
  const { status } = useSession(); // Optional: you can guard admin roles on the server/API already
  const [requesterEmail, setRequesterEmail] = useState("ironacregym@gmail.com");
  const [bookingType, setBookingType] = useState<"competition"|"casual">("casual");
  const [clubName, setClubName] = useState("Ipswich GC");
  const [targetDate, setTargetDate] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [timeWindowSecs, setTimeWindowSecs] = useState(45);
  const [members, setMembers] = useState<Member[]>([
    { full_name: "Rob Laing", club_id: "123456" }
  ]);
  const [notes, setNotes] = useState("MVP connectivity check only");
  const [runAtIso, setRunAtIso] = useState("");

  // Optional credentials just for this run (avoid storing long-term)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const addMember = () => setMembers((m) => [...m, { full_name: "", club_id: "" }]);
  const updateMember = (i: number, patch: Partial<Member>) => {
    setMembers((m) => m.map((mm, idx) => (idx === i ? { ...mm, ...patch } : mm)));
  };
  const removeMember = (i: number) => setMembers((m) => m.filter((_, idx) => idx !== i));

  const queueRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      // Allow quick scheduling: if runAtIso empty, default to now+60s
      const runAt = runAtIso && !isNaN(Date.parse(runAtIso))
        ? new Date(runAtIso).toISOString()
        : new Date(Date.now() + 60_000).toISOString();

      // Optional: encrypt credentials if provided and crypto helper exists.
      let enc_credentials_b64: string | undefined;
      if (username && password && encryptJson) {
        try {
          enc_credentials_b64 = encryptJson({ username, password });
        } catch {
          // Fallback: omit credentials if encryption failed
          enc_credentials_b64 = undefined;
        }
      }

      const payload = {
        requester_email: requesterEmail,
        booking_type: bookingType,
        club_name: clubName || undefined,
        target_date: targetDate,
        target_time: targetTime,
        time_window_secs: Number(timeWindowSecs) || 45,
        members,
        run_at: runAt,
        notes: notes || undefined,
        enc_credentials_b64
      };

      const r = await fetch("/api/integrations/hdidido/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Request failed");

      setResult(j);
    } catch (err: any) {
      setError(err?.message || "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Queue HowDidiDo Booking | BXKR</title>
      </Head>
      <main className="container py-3" style={{ color: "#fff" }}>
        <h1 className="h4 mb-3">Queue a HowDidiDo booking</h1>

        {/* Optional: simple status note */}
        {status !== "authenticated" && (
          <div className="alert alert-warning">You’re not signed in. The API requires authentication.</div>
        )}

        <form onSubmit={queueRequest} className="card p-3" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Requester email</label>
              <input className="form-control" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} required />
            </div>

            <div className="col-md-3">
              <label className="form-label">Booking type</label>
              <select className="form-select" value={bookingType} onChange={(e) => setBookingType(e.target.value as any)}>
                <option value="casual">Casual</option>
                <option value="competition">Competition</option>
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">Club name (optional)</label>
              <input className="form-control" value={clubName} onChange={(e) => setClubName(e.target.value)} />
            </div>

            <div className="col-md-3">
              <label className="form-label">Target date (YYYY-MM-DD)</label>
              <input className="form-control" placeholder="2026-01-22" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
            </div>

            <div className="col-md-3">
              <label className="form-label">Target time (HH:mm)</label>
              <input className="form-control" placeholder="07:59" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} required />
            </div>

            <div className="col-md-3">
              <label className="form-label">Window (seconds)</label>
              <input type="number" className="form-control" value={timeWindowSecs} onChange={(e) => setTimeWindowSecs(Number(e.target.value || 45))} />
            </div>

            <div className="col-md-3">
              <label className="form-label">Run at (ISO, optional)</label>
              <input className="form-control" placeholder="2026-01-22T07:58:30Z" value={runAtIso} onChange={(e) => setRunAtIso(e.target.value)} />
              <div className="form-text">Leave empty to run ~60s from now.</div>
            </div>

            <div className="col-12">
              <label className="form-label">Notes (optional)</label>
              <input className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {/* Members list */}
            <div className="col-12">
              <label className="form-label">Members</label>
              {members.map((m, i) => (
                <div key={i} className="row g-2 align-items-end mb-2">
                  <div className="col-md-4">
                    <input className="form-control" placeholder="Full name" value={m.full_name} onChange={(e) => updateMember(i, { full_name: e.target.value })} required />
                  </div>
                  <div className="col-md-3">
                    <input className="form-control" placeholder="Club ID (optional)" value={m.club_id || ""} onChange={(e) => updateMember(i, { club_id: e.target.value })} />
                  </div>
                  <div className="col-md-3">
                    <input className="form-control" placeholder="HDID email (optional)" value={m.hdidido_email || ""} onChange={(e) => updateMember(i, { hdidido_email: e.target.value })} />
                  </div>
                  <div className="col-md-2">
                    <button type="button" className="btn btn-outline-light w-100" onClick={() => removeMember(i)} disabled={members.length === 1}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-light btn-sm" onClick={addMember}>
                + Add member
              </button>
            </div>

            {/* Optional: one‑off credentials for this run (will be encrypted if ENCRYPTION_KEY + lib/crypto available) */}
            <div className="col-12 mt-3">
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="showCreds" onChange={(e)=> {
                  const block = document.getElementById("creds-block");
                  if (block) block.style.display = e.target.checked ? "block" : "none";
                }} />
                <label className="form-check-label" htmlFor="showCreds">Attach credentials for this run (optional)</label>
              </div>
              <div id="creds-block" style={{ display: "none" }}>
                <div className="row g-2">
                  <div className="col-md-4">
                    <input className="form-control" placeholder="HDID username/email" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <input className="form-control" placeholder="HDID password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <div className="form-text">
                      If `ENCRYPTION_KEY` and `lib/crypto.ts` are present, credentials will be AES‑GCM encrypted on submit.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 mt-3">
              <button className="btn btn-primary" disabled={submitting}>
                {submitting ? "Queuing…" : "Queue booking"}
              </button>
            </div>
          </div>
        </form>

        {/* Result / Error */}
        {error && (
          <div className="alert alert-danger mt-3">
            <strong>Error:</strong> {error}
          </div>
        )}
        {result && (
          <div className="alert alert-success mt-3">
            <div className="mb-1"><strong>Queued:</strong> {JSON.stringify(result)}</div>
            <div className="small text-muted">The runner cron checks every minute and will process it when run_at ≤ now.</div>
          </div>
        )}
      </main>
    </>
  );
}
