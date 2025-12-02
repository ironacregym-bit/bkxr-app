
import Head from "next/head";
import { useState } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../../components/BottomNav";

export default function AdminSharePage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  const [sessionId, setSessionId] = useState("");
  const [result, setResult] = useState<{ link?: string; whatsappMessage?: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  if (status === "loading") {
    return <div className="container py-4">Checking access…</div>;
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const generateLink = async () => {
    setStatusMsg("Generating link…");
    try {
      const res = await fetch("/api/bookings/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, expires_in_minutes: 60 }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ link: data.link, whatsappMessage: data.whatsappMessage });
        setStatusMsg("Link generated successfully.");
      } else {
        setStatusMsg(`Error: ${data.error || "Failed to generate link"}`);
      }
    } catch (e: any) {
      setStatusMsg(`Error: ${e?.message || "Network error"}`);
    }
  };

  const shareWhatsApp = () => {
    if (!result?.whatsappMessage) return;
    const encoded = encodeURIComponent(result.whatsappMessage);
    const waUrl = `https://wa.me/?text=${encoded}`;
    window.open(waUrl, "_blank");
  };

  const nativeShare = async () => {
    if (navigator.share && result?.whatsappMessage && result?.link) {
      try {
        await navigator.share({
          title: "BXKR Session",
          text: result.whatsappMessage,
          url: result.link,
        });
      } catch {
        setStatusMsg("Native share canceled or failed.");
      }
    } else {
      shareWhatsApp(); // fallback
    }
  };

  const copyMessage = async () => {
    if (!result?.whatsappMessage) return;
    try {
      await navigator.clipboard.writeText(result.whatsappMessage);
      setStatusMsg("Message copied to clipboard.");
    } catch {
      setStatusMsg("Failed to copy message.");
    }
  };

  return (
    <>
      <Head>
        <title>Generate WhatsApp Link - BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <main className="container py-3" style={{ paddingBottom: "70px" }}>
        <h2 className="mb-4 text-center">Generate WhatsApp Booking Link</h2>

        {statusMsg && (
          <div className={`alert ${statusMsg.startsWith("Error") ? "alert-danger" : "alert-info"}`}>
            {statusMsg}
          </div>
        )}

        <div className="mb-3">
          <label className="form-label">Session ID</label>
          <input
            className="form-control"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Enter session ID"
          />
        </div>

        <button className="btn btn-primary w-100 mb-3" onClick={generateLink} disabled={!sessionId}>
          Generate Link
        </button>

        {result?.link && (
          <div className="card p-3 mb-3">
            <div className="mb-2">
              <strong>Booking Link:</strong>
              <br />
              <a href={result.link} target="_blank" rel="noopener noreferrer">
                {result.link}
              </a>
            </div>
            <div className="mb-2">
              <strong>WhatsApp Message:</strong>
              <br />
              <small style={{ whiteSpace: "pre-wrap" }}>{result.whatsappMessage}</small>
            </div>
            <div className="d-flex flex-column gap-2">
              <button className="btn btn-success w-100" onClick={shareWhatsApp}>
                Share on WhatsApp
              </button>
              <button className="btn btn-primary w-100" onClick={nativeShare}>
                Share via Device
              </button>
              <button className="btn btn-outline-secondary w-100" onClick={copyMessage}>
                Copy Message
              </button>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
