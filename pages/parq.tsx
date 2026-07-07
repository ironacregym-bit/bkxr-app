// pages/parq.tsx
import Head from "next/head";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
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

function normaliseQueryString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function safeReturnTo(value: string) {
  const cleaned = String(value || "").trim();

  if (!cleaned) return "/";
  if (cleaned.startsWith("/") && !cleaned.startsWith("//")) return cleaned;

  return "/";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function canvasHasInk(canvas: HTMLCanvasElement | null) {
  if (!canvas) return false;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true;
  }

  return false;
}

export default function ParqPage() {
  const { status, data } = useSession();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  const [answers, setAnswers] = useState<ParqAnswers>({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q6: "",
    q7: "",
  });

  const [photosConsent, setPhotosConsent] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [medicalNotes, setMedicalNotes] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sessionId = useMemo(() => {
    if (!mounted) return "";

    const value = router.query.session;
    return typeof value === "string" ? value : "";
  }, [router.query.session, mounted]);

  const returnTo = useMemo(() => {
    if (!mounted) return "/";

    return safeReturnTo(normaliseQueryString(router.query.returnTo));
  }, [router.query.returnTo, mounted]);

  const hasRedFlag = useMemo(() => {
    return Object.values(answers).includes("yes");
  }, [answers]);

  const allAnswered = useMemo(() => {
    return Object.values(answers).every((answer) => answer === "yes" || answer === "no");
  }, [answers]);

  const isAuthed = mounted && status === "authenticated";
  const sessionEmail = isAuthed ? String((data?.user as any)?.email || "") : "";
  const sessionName = isAuthed ? String((data?.user as any)?.name || "") : "";

  useEffect(() => {
    if (!mounted) return;
    if (status !== "authenticated") return;

    if (sessionEmail && !email) {
      setEmail(sessionEmail);
    }

    if (sessionName && !fullName) {
      setFullName(sessionName);
    }
  }, [mounted, status, sessionEmail, sessionName, email, fullName]);

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getCanvasPoint(event);
    if (!point) return;

    event.preventDefault();

    drawingRef.current = true;

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getCanvasPoint(event);
    if (!point) return;

    event.preventDefault();

    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    if (!hasSignature) {
      setHasSignature(true);
    }
  }

  function finishStroke(event?: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawingRef.current = false;

    if (event) {
      event.preventDefault();

      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }

    setHasSignature(canvasHasInk(canvas));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function setAnswer(key: keyof ParqAnswers, value: Answer) {
    setAnswers((prev) => ({
      ...prev,
      value,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setError(null);

    if (!allAnswered) {
      setError("Please answer all PAR-Q questions.");
      return;
    }

    if (!consentConfirmed) {
      setError("Please confirm the consent statement.");
      return;
    }

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!emergencyName.trim()) {
      setError("Please enter an emergency contact.");
      return;
    }

    if (!emergencyPhone.trim()) {
      setError("Please enter an emergency contact phone.");
      return;
    }

    if (!hasSignature || !canvasHasInk(canvasRef.current)) {
      setError("Please provide your signature.");
      return;
    }

    if (email && !isValidEmail(email)) {
      setError("Please enter a valid email.");
      return;
    }

    setBusy(true);

    try {
      const signature_b64 = canvasRef.current
        ? canvasRef.current.toDataURL("image/jpeg", 0.85)
        : undefined;

      const payload = {
        answers,
        medical_notes: medicalNotes.trim() || undefined,
        emergency_contact_name: emergencyName.trim(),
        emergency_contact_phone: emergencyPhone.trim(),
        photos_consent: photosConsent,
        consent_confirmed: consentConfirmed,
        signed_name: fullName.trim(),
        provided_email: email.trim() || undefined,
        requires_medical_review: hasRedFlag,
        session_id: sessionId || undefined,
        signature_b64,
      };

      const res = await fetch("/api/parq/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Submission failed."));
      }

      if (status === "authenticated") {
        await router.replace(returnTo || "/");
        return;
      }

      const nextRegister = `/register?parq=ok&callbackUrl=${encodeURIComponent(returnTo || "/")}`;

      await router.replace(
        `/parq/success?linked=0&register=${encodeURIComponent(nextRegister)}`
      );
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>PAR-Q • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main
        className="ia-app container py-4"
        style={{
          minHeight: "100vh",
          paddingBottom: 90,
          color: "#fff",
          background:
            "radial-gradient(circle at top right, rgba(24,255,154,0.10), transparent 34%), linear-gradient(to bottom, #070a0d 0%, #0d1416 55%, #111a16 100%)",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Link href ="/">
            <img src="/iron_acre_logo_transparent.png"></img>
            <span className="fw-bold"
              style={{
                      color: "#fff",
                      fontSize: "1rem"}}
            >Iron Acre</span>
          </Link>

          <Link href={returnTo}>
              Back
            </Link>

        </div>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-kicker">
            <i className="fas fa-notes-medical" />
            health screening
          </div>

          <h1
            className="mt-2 mb-0"
            style={{
              fontSize: "1.65rem",
              lineHeight: 1.05,
              fontWeight: 900,
              letterSpacing: "-0.035em",
            }}
          >
            PAR-Q{" "}
            <span
              style={{
                color: "var(--ia-neon)",
                textShadow: "0 0 16px rgba(24,255,154,0.18)",
              }}
            >
              Iron Acre Gym
            </span>
          </h1>

          <p className="ia-page-subtitle mt-2">
            Please answer honestly before taking part in gym training. This helps coaches understand
            whether any additional support or review is needed.
          </p>

          {hasRedFlag ? (
            <div className="ia-alert ia-alert-green mt-3">
              One or more answers may require medical guidance before intense physical activity.
            </div>
          ) : null}
        </section>

        <form onSubmit={handleSubmit} className="d-grid gap-3">
          <section className="ia-tile ia-tile-pad">
            <div className="ia-card-title-compact">PAR-Q questions</div>
            <div className="text-dim small mt-1">
              Answer all seven questions before submitting.
            </div>

            <div className="d-grid gap-3 mt-3">
              <ParqQuestion
                label="Has your doctor ever said that you have a heart condition or high blood pressure?"
                value={answers.q1}
                onChange={(value) => setAnswer("q1", value)}
              />

              <ParqQuestion
                label="Do you feel pain in your chest when you perform physical activity?"
                value={answers.q2}
                onChange={(value) => setAnswer("q2", value)}
              />

              <ParqQuestion
                label="In the past month, have you had chest pain when not doing physical activity?"
                value={answers.q3}
                onChange={(value) => setAnswer("q3", value)}
              />

              <ParqQuestion
                label="Do you lose balance because of dizziness or ever lose consciousness?"
                value={answers.q4}
                onChange={(value) => setAnswer("q4", value)}
              />

              <ParqQuestion
                label="Do you have a bone or joint problem that could worsen with physical activity?"
                value={answers.q5}
                onChange={(value) => setAnswer("q5", value)}
              />

              <ParqQuestion
                label="Is your doctor prescribing medication for blood pressure or heart conditions?"
                value={answers.q6}
                onChange={(value) => setAnswer("q6", value)}
              />

              <ParqQuestion
                label="Do you know of any other reason why you should not participate in physical activity?"
                value={answers.q7}
                onChange={(value) => setAnswer("q7", value)}
              />
            </div>
          </section>

          <section className="ia-tile ia-tile-pad">
            <div className="ia-card-title-compact">Medical notes</div>

            <div className="text-dim small mt-1">
              Add anything coaches should know before you train.
            </div>

            <textarea
              className="form-control ia-form-input mt-3"
              rows={4}
              placeholder="Injuries, medical conditions, restrictions or context..."
              value={medicalNotes}
              onChange={(event) => setMedicalNotes(event.target.value)}
            />
          </section>

          <section className="ia-tile ia-tile-pad">
            <div className="ia-card-title-compact">Emergency contact</div>

            <div className="row g-2 mt-2">
              <div className="col-12 col-md-6">
                <label className="form-label ia-label">Contact name</label>

                <input
                  type="text"
                  className="form-control ia-form-input"
                  value={emergencyName}
                  onChange={(event) => setEmergencyName(event.target.value)}
                  required
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label ia-label">Contact phone</label>

                <input
                  type="tel"
                  className="form-control ia-form-input"
                  value={emergencyPhone}
                  onChange={(event) => setEmergencyPhone(event.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          <section className="ia-tile ia-tile-pad">
            <div className="ia-card-title-compact">Consent and signature</div>

            <div className="d-grid gap-3 mt-3">
              <label className="d-flex align-items-start gap-2" style={{ cursor: "pointer" }}>
                <input
                  className="form-check-input ia-checkbox"
                  type="checkbox"
                  checked={photosConsent}
                  onChange={(event) => setPhotosConsent(event.target.checked)}
                  style={{ marginTop: 3 }}
                />

                <span>I’m happy for photos/videos to be used on Iron Acre Gym social media.</span>
              </label>

              <label className="d-flex align-items-start gap-2" style={{ cursor: "pointer" }}>
                <input
                  className="form-check-input ia-checkbox"
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(event) => setConsentConfirmed(event.target.checked)}
                  required
                  style={{ marginTop: 3 }}
                />

                <span>
                  I confirm the information provided is accurate to the best of my knowledge. I
                  understand physical training carries risk of injury. I agree to follow coach
                  instruction, use equipment responsibly and stop exercise if I feel unwell.
                </span>
              </label>

              <div>
                <label className="form-label ia-label">Full name</label>

                <input
                  type="text"
                  className="form-control ia-form-input"
                  placeholder="Your full legal name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label ia-label">
                  Email{" "}
                  {isAuthed ? (
                    <span className="text-dim">(linked)</span>
                  ) : (
                    <span className="text-dim">(optional)</span>
                  )}
                </label>

                <input
                  type="email"
                  className="form-control ia-form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isAuthed}
                />

                {isAuthed && sessionEmail ? (
                  <div className="small mt-1 text-dim">
                    Linked to <span className="ia-linked-email">{sessionEmail}</span>
                  </div>
                ) : null}
              </div>

              <div>
                <label className="form-label ia-label">Signature</label>

                <div className="ia-signature-wrap">
                  <canvas
                    ref={canvasRef}
                    width={900}
                    height={220}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={finishStroke}
                    onPointerLeave={finishStroke}
                    onPointerCancel={finishStroke}
                    style={{
                      width: "100%",
                      height: 220,
                      touchAction: "none",
                      display: "block",
                      cursor: "crosshair",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                    }}
                  />
                </div>

                <div className="d-flex justify-content-between align-items-center gap-2 mt-2">
                  <div className="text-dim small">
                    Sign with a finger or mouse.
                  </div>

                  <button type="button" className="ia-btn ia-btn-muted" onClick={clearSignature}>
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <section className="ia-tile ia-tile-pad">
              <div className="ia-inline-note-error" role="alert">
                {error}
              </div>
            </section>
          ) : null}

          <button type="submit" className="ia-btn-primary w-100" disabled={busy || !mounted}>
            {busy ? "Submitting..." : "Submit PAR-Q"}
          </button>

          <div className="small text-center text-dim">
            By submitting this form you agree to the{" "}
            <Link href="/terms">membership terms and participation waiver</Link>.
          </div>

          <div className="small text-center text-dim">
            Submissions are timestamped automatically. Session link:{" "}
            {sessionId ? `#${sessionId}` : "None"}
          </div>
        </form>

        <footer className="text-center small text-dim mt-4">
          © {new Date().getFullYear()} Iron Acre Gym · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>

      <style jsx>{`
        .text-dim {
          color: var(--ia-muted);
        }

        .ia-label {
          color: rgba(255, 255, 255, 0.86);
          font-weight: var(--ia-fw-semi);
          margin-bottom: 6px;
        }

        .ia-form-input {
          min-height: 46px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          color: #fff;
        }

        .ia-form-input:focus {
          border-color: rgba(24, 255, 154, 0.45);
          box-shadow: 0 0 0 3px rgba(24, 255, 154, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: #fff;
        }

        .ia-form-input::placeholder {
          color: rgba(255, 255, 255, 0.38);
        }

        .ia-checkbox:checked {
          background-color: var(--ia-neon);
          border-color: var(--ia-neon);
        }

        .ia-checkbox:focus {
          box-shadow: 0 0 0 3px rgba(24, 255, 154, 0.14);
          border-color: rgba(24, 255, 154, 0.5);
        }

        .ia-alert {
          border-radius: 14px;
          padding: 12px 14px;
          color: #fff;
        }

        .ia-alert-green {
          background: rgba(24, 255, 154, 0.12);
          border: 1px solid rgba(24, 255, 154, 0.28);
        }

        .ia-signature-wrap {
          border-radius: 14px;
          border: 1px dashed rgba(255, 255, 255, 0.28);
          background: rgba(255, 255, 255, 0.03);
          overflow: hidden;
        }

        .ia-linked-email {
          color: var(--ia-neon);
          font-weight: 700;
        }
      `}</style>
    </>
  );
}

function ParqQuestion(props: {
  label: string;
  value: Answer;
  onChange: (value: Answer) => void;
}) {
  const { label, value, onChange } = props;
  const nameId = useId();

  return (
    <div className="ia-parq-question">
      <label className="ia-parq-label">{label}</label>

      <div className="ia-parq-options">
        <button
          type="button"
          className={value === "yes" ? "ia-parq-option-selected" : "ia-parq-option"}
          onClick={() => onChange("yes")}
        >
          Yes
        </button>

        <button
          type="button"
          className={value === "no" ? "ia-parq-option-selected" : "ia-parq-option"}
          onClick={() => onChange("no")}
        >
          No
        </button>
      </div>

      <input type="hidden" name={nameId} value={value} />

      <style jsx>{`
        .ia-parq-question {
          display: grid;
          gap: 10px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ia-parq-label {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 700;
          line-height: 1.35;
        }

        .ia-parq-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .ia-parq-option,
        .ia-parq-option-selected {
          border-radius: 999px;
          min-height: 38px;
          font-size: 0.86rem;
          font-weight: 800;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ia-parq-option {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .ia-parq-option-selected {
          border: none;
          color: #041311;
          background: linear-gradient(135deg, var(--ia-neon), var(--ia-neon2));
          box-shadow: var(--ia-btn-primary-shadow);
        }
      `}</style>
    </div>
  );
}
