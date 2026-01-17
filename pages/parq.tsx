
// /pages/parq.tsx
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

type Answer = "yes" | "no" | "";
type ParqAnswers = {
  q1: Answer;
  q2: Answer;
  q3: Answer;
  q4: Answer;
  q5: Answer;
  q6: Answer;
  q7: Answer;
};

export default function ParqPage() {
  const ACCENT = "#FF8A2A";
  const { status, data } = useSession();
  const router = useRouter();

  // Hydration-safe mount flag
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Form state
  const [answers, setAnswers] = useState<ParqAnswers>({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q6: "",
    q7: "",
  });
  const [photosConsent, setPhotosConsent] = useState<boolean>(false);
  const [consentConfirmed, setConsentConfirmed] = useState<boolean>(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef<boolean>(false);
  const [hasSignature, setHasSignature] = useState(false);

  const sessionId = useMemo(() => {
    if (!mounted) return "";
    const v = router.query.session;
    return typeof v === "string" ? v : "";
  }, [router.query.session, mounted]);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // Auto-populate email when authenticated (hydration-safe, non-destructive)
  useEffect(() => {
    if (!mounted) return;
    if (status === "authenticated") {
      const sessionEmail = (data?.user as any)?.email || "";
      if (sessionEmail && !email) {
        setEmail(sessionEmail);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, status, data?.user]);

  // Canvas helpers (touch + mouse)
  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#fff";

    const getPos = (evt: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if ((evt as TouchEvent).touches && (evt as TouchEvent).touches.length) {
        const t = (evt as TouchEvent).touches[0];
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
      } else {
        const m = evt as MouseEvent;
        return { x: m.clientX - rect.left, y: m.clientY - rect.top };
      }
    };

    const onDown = (evt: MouseEvent | TouchEvent) => {
      evt.preventDefault();
      drawing.current = true;
      const { x, y } = getPos(evt);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const onMove = (evt: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      evt.preventDefault();
      const { x, y } = getPos(evt);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    };
    const onUp = (evt: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      evt.preventDefault();
      drawing.current = false;
    };

    // Mouse
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    // Touch
    canvas.addEventListener("touchstart", onDown, { passive: false });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [mounted]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const setAnswer = (key: keyof ParqAnswers, val: Answer) => {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  };

  const allAnswered = useMemo(() => {
    return Object.values(answers).every((a) => a === "yes" || a === "no");
  }, [answers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!allAnswered) {
      setError("Please answer all PAR‑Q questions.");
      return;
    }
    if (!consentConfirmed) {
      setError("Please confirm you understand and accept the consent statement.");
      return;
    }
    if (!fullName.trim()) {
      setError("Please enter your full name to sign.");
      return;
    }
    if (email && !isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      // Compress signature if present (use JPEG to allow quality)
      let signature_b64: string | undefined = undefined;
      if (hasSignature && canvasRef.current) {
        signature_b64 = canvasRef.current.toDataURL("image/jpeg", 0.8);
      }

      const payload = {
        answers,
        photos_consent: photosConsent,
        consent_confirmed: consentConfirmed,
        signed_name: fullName.trim(),
        provided_email: email.trim() || undefined,
        session_id: sessionId || undefined,
        signature_b64,
      };

      const res = await fetch("/api/parq/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Submit failed with ${res.status}`);
      }

      const showRegisterCta = status !== "authenticated";
      const nextRegister = "/register?parq=ok";
      const successUrl = showRegisterCta
        ? `/parq/success?linked=0&register=${encodeURIComponent(nextRegister)}`
        : `/parq/success?linked=1`;

      await router.replace(successUrl);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const isAuthed = mounted && status === "authenticated";
  const sessionEmail = isAuthed ? (data?.user as any)?.email || "" : "";

  return (
    <>
      <Head>
        <title>PAR‑Q • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-4" style={{ paddingBottom: 80, color: "#fff" }}>
        {/* Top: logo & back */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <img
              src="/BXKRLogoNoBG.jpg"
              alt="BXKR"
              height={34}
              style={{ borderRadius: 8, display: "block" }}
            />
          </div>
          <Link href="/" className="btn-bxkr-outline">Back</Link>
        </div>

        {/* Heading */}
        <section className="mb-3">
          <h1 className="fw-bold" style={{ fontSize: "1.8rem", lineHeight: 1.2 }}>
            Health <span style={{ color: ACCENT }}>PAR‑Q</span>
          </h1>
          <p className="text-dim mt-2 mb-0">
            Please answer the PAR‑Q questions honestly. If you answer “Yes” to any, consult your GP before exercising.
          </p>
        </section>

        {/* Form card */}
        <section className="futuristic-card p-3 mb-3">
          <form onSubmit={handleSubmit} className="d-grid gap-3">
            {/* Questions */}
            <div className="d-grid gap-3">
              <ParqQuestion
                label="Has your doctor ever said that you have a heart condition or high blood pressure?"
                value={answers.q1}
                onChange={(v) => setAnswer("q1", v)}
              />
              <ParqQuestion
                label="Do you feel pain in your chest when you perform physical activity?"
                value={answers.q2}
                onChange={(v) => setAnswer("q2", v)}
              />
              <ParqQuestion
                label="In the past month, have you had chest pain when you were not doing physical activity?"
                value={answers.q3}
                onChange={(v) => setAnswer("q3", v)}
              />
              <ParqQuestion
                label="Do you lose balance because of dizziness or do you ever lose consciousness?"
                value={answers.q4}
                onChange={(v) => setAnswer("q4", v)}
              />
              <ParqQuestion
                label="Do you have a bone or joint problem that could be made worse by a change in your physical activity?"
                value={answers.q5}
                onChange={(v) => setAnswer("q5", v)}
              />
              <ParqQuestion
                label="Is your doctor currently prescribing drugs (for example, water pills) for your blood pressure or heart condition?"
                value={answers.q6}
                onChange={(v) => setAnswer("q6", v)}
              />
              <ParqQuestion
                label="Do you know of any other reason why you should not do physical activity?"
                value={answers.q7}
                onChange={(v) => setAnswer("q7", v)}
              />
            </div>

            {/* Photos consent */}
            <div className="form-check mt-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="photosConsent"
                checked={photosConsent}
                onChange={(e) => setPhotosConsent(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="photosConsent">
                I’m happy for photos/videos to be taken during sessions and used on BXKR / Iron Acre social media.
              </label>
            </div>

            {/* General consent */}
            <div className="form-check mt-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="consentConfirmed"
                checked={consentConfirmed}
                onChange={(e) => setConsentConfirmed(e.target.checked)}
                required
              />
              <label className="form-check-label" htmlFor="consentConfirmed">
                I confirm that the above information is correct and I understand I should stop if I feel unwell.
              </label>
            </div>

            {/* Name + email */}
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label">Full name (signature)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Your full legal name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="col-12">
                <label className="form-label">
                  Email {isAuthed ? <span className="text-dim">(linked)</span> : <span className="text-dim">(optional)</span>}
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder={isAuthed ? "" : "you@example.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isAuthed}
                />
                {isAuthed && sessionEmail && (
                  <div className="small text-dim mt-1">Linked to <span style={{ color: ACCENT }}>{sessionEmail}</span></div>
                )}
              </div>
            </div>

            {/* Signature canvas (optional) */}
            <div>
              <label className="form-label">Draw signature (optional)</label>
              <div
                className="rounded"
                style={{
                  border: "1px dashed rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={180}
                  style={{ width: "100%", height: 180, touchAction: "none", display: "block" }}
                  aria-label="Signature pad"
                />
              </div>
              <div className="d-flex justify-content-end mt-2">
                <button
                  type="button"
                  className="btn-bxkr-outline"
                  onClick={clearSignature}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Errors */}
            {error && (
              <div className="alert alert-danger mt-1" role="alert">
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="bxkr-btn" disabled={busy || !mounted}>
              {busy ? "Submitting…" : "Submit PAR‑Q"}
            </button>

            {/* Footnote */}
            <div className="text-dim small text-center mt-2">
              Submissions are timestamped automatically. Session link: {sessionId ? `#${sessionId}` : "None"}.
            </div>
          </form>
        </section>

        {/* Footer */}
        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} BXKR · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}

function ParqQuestion(props: { label: string; value: Answer; onChange: (v: Answer) => void }) {
  const { label, value, onChange } = props;
  const nameId = useMemo(() => Math.random().toString(36).slice(2), []);
  return (
    <div className="d-grid gap-2">
      <label className="form-label mb-1">{label}</label>
      <div className="d-flex gap-3">
        <div className="form-check">
          <input
            className="form-check-input"
            type="radio"
            name={nameId}
            id={`${nameId}-yes`}
            checked={value === "yes"}
            onChange={() => onChange("yes")}
          />
          <label className="form-check-label" htmlFor={`${nameId}-yes`}>
            Yes
          </label>
        </div>
        <div className="form-check">
          <input
            className="form-check-input"
            type="radio"
            name={nameId}
            id={`${nameId}-no`}
            checked={value === "no"}
            onChange={() => onChange("no")}
          />
          <label className="form-check-label" htmlFor={`${nameId}-no`}>
            No
          </label>
        </div>
      </div>
    </div>
  );
}
