
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/router";
import { toMillis } from "../../lib/time";

type SessionInfo = {
  class_name?: string;
  gym_name?: string;
  // `start_time` may be Firestore Timestamp, seconds, milliseconds, or ISO string
  start_time?: any;
};

export default function BookTokenPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [status, setStatus] = useState<string>("");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  // Helper to safely read token from the router
  const getToken = (): string | undefined => {
    if (!router.isReady) return undefined;
    const q = router.query?.token;
    if (typeof q === "string") return q;
    if (Array.isArray(q) && q.length > 0) return q[0];
    return undefined;
  };

  useEffect(() => {
    if (!router.isReady) return;
    const token = getToken();
    if (session && token) {
      confirmBooking(false, token); // Auto-confirm for logged-in users
    }
  }, [session, router.isReady, router.query.token]);

  const confirmBooking = async (guest = false, token?: string) => {
    const tok = token ?? getToken();
    if (!tok) return;
    setStatus("Processing...");
    try {
      const res = await fetch(`/api/book/${tok}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: guest ? JSON.stringify({ name, email }) : "{}",
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("Booking confirmed!");
        setSessionInfo(data.session as SessionInfo);
      } else {
        setStatus(`Error: ${data.error || "Failed to confirm booking"}`);
      }
    } catch (e: any) {
      setStatus(`Error: ${e?.message || "Network error"}`);
    }
  };

  const buildCalendarLink = () => {
    const ms = toMillis(sessionInfo?.start_time);
    if (!ms) return "#";
    const start = new Date(ms);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // default +1 hour
    const formatDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const startStr = formatDate(start);
    const endStr = formatDate(end);
    const title = encodeURIComponent(
      `BXKR Session${sessionInfo?.class_name ? ` - ${sessionInfo.class_name}` : ""}`
    );
    const details = encodeURIComponent(
      `Location: ${sessionInfo?.gym_name || "BXKR Gym"}`
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`;
  };

  return (
    <div className="container py-4">
      <h3 className="mb-3">BXKR Session Booking</h3>

      {status && (
        <div
          className={`alert ${
            status.startsWith("Error") ? "alert-danger" : "alert-info"
          }`}
        >
          {status}
        </div>
      )}

      {sessionInfo && (
        <div className="card p-3 mb-3">
          <h5 className="mb-1">{sessionInfo.class_name || "BXKR Session"}</h5>
          <p className="mb-1">{sessionInfo.gym_name || "BXKR Gym"}</p>
          {sessionInfo.start_time ? (
            <p className="mb-0">
              {(() => {
                const ms = toMillis(sessionInfo.start_time);
                return ms ? new Date(ms).toLocaleString() : "Date TBD";
              })()}
            </p>
          ) : null}
        </div>
      )}

      {!session && !status.includes("confirmed") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmBooking(true);
          }}
        >
          <div className="mb-3">
            <label className="form-label">Name</label>
            <input
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <button className="btn btn-primary w-100" type="submit">
            Book Session
          </button>
        </form>
      )}

      {status.includes("confirmed") && (
        <div className="mt-3">
          <a
            href={buildCalendarLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-info w-100 mb-2"
          >
            Add to Google Calendar
          </a>
          <button
            className="btn btn-success w-100 mb-2"
            onClick={() => signIn("google")}
          >
            Sign in with Google
          </button>
          <button
            className="btn btn-outline-secondary w-100"
            onClick={() => signIn("email")}
          >
            Sign in with Email
          </button>
        </div>
      )}
    </div>
  );
}
