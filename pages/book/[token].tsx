
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/router";

export default function BookTokenPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState("");
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (session && token) {
      confirmBooking(); // Auto-confirm for logged-in users
    }
  }, [session, token]);

  const confirmBooking = async (guest = false) => {
    setStatus("Processing...");
    const res = await fetch(`/api/book/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: guest ? JSON.stringify({ name, email }) : "{}",
    });
    const data = await res.json();
    if (data.ok) {
      setStatus("Booking confirmed!");
      setSessionInfo(data.session);
    } else {
      setStatus(`Error: ${data.error}`);
    }
  };

  return (
    <div className="container py-4">
      <h3 className="mb-3">BXKR Session Booking</h3>
      {status && <div className="alert alert-info">{status}</div>}
      {sessionInfo && (
        <div className="card p-3 mb-3">
          <h5>{sessionInfo.class_name}</h5>
          <p>{sessionInfo.gym_name}</p>
          <p>{new Date(sessionInfo.start_time * 1000).toLocaleString()}</p>
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
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary w-100">Book Session</button>
        </form>
      )}
      {status.includes("confirmed") && (
        <div className="mt-3">
          <button className="btn btn-success w-100 mb-2" onClick={() => signIn("google")}>
            Sign in with Google
          </button>
          <button className="btn btn-outline-secondary w-100" onClick={() => signIn("email")}>
            Sign in with Email
          </button>
        </div>
      )}
    </div>
  );
}
