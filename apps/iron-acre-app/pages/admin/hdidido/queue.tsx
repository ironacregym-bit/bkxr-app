
// pages/admin/hdidido/queue.tsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useSession } from "next-auth/react";

// Optional: AES-GCM encryption helper (if you added lib/crypto.ts and ENV ENCRYPTION_KEY)
// This try/catch keeps the UI working even if crypto isn't present.
let encryptJson: ((obj: unknown) => string) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  encryptJson = require("../../../lib/crypto").encryptJson as (obj: unknown) => string;
} catch {
  // Okay if not present; we just won't attach enc_credentials_b64.
}

type Member = { full_name: string; club_id?: string; hdidido_email?: string };

function toLocalYMD(d: Date): string {
  // yyyy-mm-dd in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toLocalHM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function nextMinuteISO(): string {
  const n = new Date(Date.now() + 60_000);
  return n.toISOString();
}

export default function HdididoQueueAdmin() {
  const { status } = useSession(); // (Optional) server/API is already guarding auth

  // Form state
  const [requesterEmail, setRequesterEmail] = useState("ben.jones1974@hotmail.co.uk");
  const [bookingType, setBookingType] = useState<"competition" | "casual">("casual");
  const [clubName, setClubName] = useState("Ipswich GC");

  // Date/time pickers (use native inputs)
  const [targetDate, setTargetDate] = useState<string>(() => toLocalYMD(new Date()));
  const [targetTime, setTargetTime] = useState<string>(() => toLocalHM(new Date()));

  const [timeWindowSecs, setTimeWindowSecs] = useState<number>(45);
  const [members, setMembers] = useState<Member[]>([{ full_name: "Rob Laing", club_id: "123456" }]);
  const [notes, setNotes] = useState("Queue a booking (MVP)");

  // Run time (ISO). Default to ~now + 60 seconds
  const [runAtIso, setRunAtIso] = useState<string>(() => nextMinuteISO());

  // Optional one-off credentials
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived preview of the task the API will generate server-side
  const taskPreview = useMemo(
    () => ({ type: "book", date: targetDate, time: targetTime, mode: bookingType }),
    [targetDate, targetTime, bookingType]
  );

  function addMember() {
    setMembers((m) => [...m, { full_name: "", club_id: "" }]);
  }
  function updateMember(i: number, patch: Partial<Member>) {
    setMembers((m) => m.map((mm, idx) => (idx === i ? { ...mm, ...patch } : mm)));
  }
  function removeMember(i: number) {
    setMembers((m) => m.filter((_, idx) => idx !== i));
  }

  // Helpers: quick default for runAt
  function setRunAtToNextMinute() {
    setRunAtIso(nextMinuteISO());
  }

  // Soft validation
  const formErrors = useMemo(() => {
    const errs: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) errs.push("Target date must be YYYY-MM-DD.");
    if (!/^\d{1,2}:\d{2}$/.test(targetTime)) errs.push("Target time must be HH:mm (24h).");
    if (!requesterEmail?.includes("@")) errs.push("Requester email looks invalid.");
    if (Number.isNaN(Number(timeWindowSecs)) || timeWindowSecs < 0) errs.push("Time window must be a positive number.");
    if (runAtIso && Number.isNaN(Date.parse(runAtIso))) errs.push("Run at (ISO) is invalid.");
    if (!members.length || !members[0].full_name.trim()) errs.push("At least 1 member full name is required.");
    return errs;
  }, [targetDate, targetTime, requesterEmail, timeWindowSecs, runAtIso, members]);

  useEffect(() => {
    // Keep result panel clean when user edits fields
    if (result) setResult(null);
    if (error) setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, targetTime, bookingType, runAtIso]);

  async function queueRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      if (formErrors.length > 0) {
        throw new Error(formErrors.join(" "));
      }
      const runAt =
        runAtIso && !Number.isNaN(Date.parse(runAtIso)) ? new Date(runAtIso).toISOString() : nextMinuteISO();

      // Optional encryption for credentials
      let enc_credentials_b64: string | undefined;
      if (username && password && encryptJson) {
        try {
          enc_credentials_b64 = encryptJson({ username, password });
        } catch {
          // Encryption failed—skip attaching
          enc_credentials_b64 = undefined;
        }
      }

      const payload = {
        requester_email: requesterEmail,
        booking_type: bookingType,
        club_name: clubName || undefined,
        target_date: targetDate, // YYYY-MM-DD
        target_time: targetTime, // HH:mm (24h)
        time_window_secs: Number(timeWindowSecs) || 45,
        members,
        run_at: runAt,
        notes: notes || undefined,
        enc_credentials_b64,
        // no need to send task; server builds it from target_date/target_time
      };

      const r = await fetch("/api/integrations/hdidido/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Request failed");
      setResult(j);
    } catch (err: any) {
      setError(err?.message || "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Queue HowDidiDo Booking | BXKR</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff" }}>
        <h1 className="h4 mb-3">Queue a HowDidiDo booking</h1>

        {/* Optional: sign-in hint; API enforces auth anyway */}
        {status !== "authenticated" && (
          <div className="alert alert-warning">
            You’re not signed in. The API requires authentication.
          </div>
        )}

        <form onSubmit={queueRequest} className="card p-3" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
          <div className="row g-3">
            {/* Requester / Type / Club */}
            <div className="col-md-6">
              <label className="form-label">Requester email</label>
              <input
                className="form-control"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                required
                inputMode="email"
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">Booking type</label>
              <select
                className="form-select"
                value={bookingType}
                onChange={(e) => setBookingType(e.target.value as any)}
              >
                <option value="casual">Casual</option>
                <option value="competition">Competition</option>
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label">Club name (optional)</label>
              <input
                className="form-control"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="e.g., Ipswich GC"
              />
            </div>

            {/* Date & Time */}
            <div className="col-md-3">
              <label className="form-label">Target date</label>
              <input
                type="date"
                className="form-control"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">Target time</label>
              <input
                type="time"
                className="form-control"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                step={60}
                required
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">Window (seconds)</label>
              <input
                type="number"
                className="form-control"
                value={timeWindowSecs}
                min={0}
                onChange={(e) => setTimeWindowSecs(Number(e.target.value || 45))}
              />
            </div>

            {/* Run at */}
            <div className="col-md-3">
              <label className="form-label d-flex justify-content-between">
                <span>Run at (ISO)</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light"
                  onClick={setRunAtToNextMinute}
                  title="Set to next minute"
                >
                  Next minute
                </button>
              </label>
              <input
                className="form-control"
                placeholder="2026-01-22T07:58:30Z"
                value={runAtIso}
                onChange={(e) => setRunAtIso(e.target.value)}
              />
              <div className="form-text">Leave empty to run ~60s from now.</div>
            </div>

            {/* Notes */}
            <div className="col-12">
              <label className="form-label">Notes (optional)</label>
              <input
                className="form-control"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Members */}
            <div className="col-12">
              <label className="form-label">Members</label>
              {members.map((m, i) => (
                <div key={i} className="row g-2 align-items-end mb-2">
                  <div className="col-md-4">
                    <input
                      className="form-control"
                      placeholder="Full name"
                      value={m.full_name}
                      onChange={(e) => updateMember(i, { full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <input
                      className="form-control"
                      placeholder="Club ID (optional)"
                      value={m.club_id || ""}
                      onChange={(e) => updateMember(i, { club_id: e.target.value })}
                    />
                  </div>
                  <div className="col-md-3">
                    <input
                      className="form-control"
                      placeholder="HDID email (optional)"
                      value={m.hdidido_email || ""}
                      onChange={(e) => updateMember(i, { hdidido_email: e.target.value })}
                    />
                  </div>
                  <div className="col-md-2">
                    <button
                      type="button"
                      className="btn btn-outline-light w-100"
                      onClick={() => removeMember(i)}
                      disabled={members.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-light btn-sm" onClick={addMember}>
                + Add member
              </button>
            </div>

            {/* One-off credentials (encrypted if lib/crypto + ENCRYPTION_KEY available) */}
            <div className="col-12 mt-3">
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="showCreds"
                  onChange={(e) => {
                    const block = document.getElementById("creds-block");
                    if (block) block.style.display = e.target.checked ? "block" : "none";
                  }}
                />
                <label className="form-check-label" htmlFor="showCreds">
                  Attach credentials for this run (optional)
                </label>
              </div>
              <div id="creds-block" style={{ display: "none" }}>
                <div className="row g-2">
                  <div className="col-md-4">
                    <input
                      className="form-control"
                      placeholder="HDID username/email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      className="form-control"
                      placeholder="HDID password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="col-md-4">
                    <div className="form-text">
                      If <code>ENCRYPTION_KEY</code> and <code>lib/crypto.ts</code> exist, credentials will be encrypted on submit.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Task preview */}
            <div className="col-12 mt-2">
              <div className="small" style={{ opacity: 0.85 }}>
                <strong>Task preview</strong>: {taskPreview.type} • {taskPreview.date} @ {taskPreview.time} ({taskPreview.mode})
              </div>
            </div>

            {/* Validation errors */}
            {formErrors.length > 0 && (
              <div className="col-12">
                <div className="alert alert-warning mb-0">
                  <strong>Fix before queuing:</strong>
                  <ul className="mb-0">
                    {formErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="col-12 mt-2">
              <button className="btn btn-primary" disabled={submitting || formErrors.length > 0}>
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
            <div className="mb-1">
              <strong>Queued:</strong> {JSON.stringify(result)}
            </div>
            <div className="small text-muted">
              The runner checks every minute and will process when <code>run_at</code> ≤ now.
            </div>
          </div>
        )}
      </main>
    </>
  );
}
