// File: pages/parq.tsx
import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/router";

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
  const { status, data } = useSession();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const drawing = useRef(false);

  const [hasSignature, setHasSignature] = useState(false);

  const sessionId = useMemo(() => {
    if (!mounted) return "";
    const v = router.query.session;
    return typeof v === "string" ? v : "";
  }, [router.query.session, mounted]);

  const hasRedFlag = useMemo(() => {
    return Object.values(answers).includes("yes");
  }, [answers]);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  useEffect(() => {
    if (!mounted) return;

    if (status === "authenticated") {
      const sessionEmail = (data?.user as any)?.email || "";
      if (sessionEmail && !email) {
        setEmail(sessionEmail);
      }
    }
  }, [mounted, status, data?.user, email]);

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";

    const getPos = (evt: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();

      if ((evt as TouchEvent).touches?.length) {
        const t = (evt as TouchEvent).touches[0];
        return {
          x: t.clientX - rect.left,
          y: t.clientY - rect.top,
        };
      }

      const m = evt as MouseEvent;
      return {
        x: m.clientX - rect.left,
        y: m.clientY - rect.top,
      };
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

      if (!hasSignature) {
        setHasSignature(true);
      }
    };

    const onUp = (evt: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;

      evt.preventDefault();
      drawing.current = false;
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

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
  }, [mounted, hasSignature]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const setAnswer = (key: keyof ParqAnswers, value: Answer) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const allAnswered = useMemo(() => {
    return Object.values(answers).every((a) => a === "yes" || a === "no");
  }, [answers]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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

    if (!hasSignature) {
      setError("Please provide your signature.");
      return;
    }

    if (email && !isValidEmail(email)) {
      setError("Please enter a valid email.");
      return;
    }

    setBusy(true);

    try {
      let signature_b64: string | undefined;

      if (canvasRef.current) {
        signature_b64 = canvasRef.current.toDataURL("image/jpeg", 0.8);
      }

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

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Submission failed.");
      }

      const showRegisterCta = status !== "authenticated";
      const nextRegister = "/register?parq=ok";

      const successUrl = showRegisterCta
        ? `/parq/success?linked=0&register=${encodeURIComponent(nextRegister)}`
        : `/parq/success?linked=1`;

      await router.replace(successUrl);
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const isAuthed = mounted && status === "authenticated";
  const sessionEmail = isAuthed ? ((data?.user as any)?.email || "") : "";

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
          paddingBottom: 80,
          color: "#fff",
          background: "linear-gradient(to bottom, #070a0d 0%, #0d1416 55%, #111a16 100%)",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <img
              src="/IronAcreLogoNoBG.png"
              alt="Iron Acre Gym"
              height={42}
              style={{ display: "block", borderRadius: 8 }}
            />
          </div>

          <Link href="/" className="ia-btn-outline">
            Back
          </Link>
        </div>

        <section className="mb-4">
          <div className="ia-kicker">Health Screening</div>

          <h1 className="ia-page-title mt-2">
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

          <p className="ia-page-subtitle">
            Please answer honestly. Participation in physical activity carries risk of injury.
          </p>

          {hasRedFlag ? (
            <div className="ia-alert ia-alert-green mt-3">
              One or more answers may require medical guidance before participating in intense physical activity.
            </div>
          ) : null}
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <form onSubmit={handleSubmit} className="d-grid gap-4">
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
                label="In the past month, have you had chest pain when not doing physical activity?"
                value={answers.q3}
                onChange={(v) => setAnswer("q3", v)}
              />

              <ParqQuestion
                label="Do you lose balance because of dizziness or ever lose consciousness?"
                value={answers.q4}
                onChange={(v) => setAnswer("q4", v)}
              />

              <ParqQuestion
                label="Do you have a bone or joint problem that could worsen with physical activity?"
                value={answers.q5}
                onChange={(v) => setAnswer("q5", v)}
              />

              <ParqQuestion
                label="Is your doctor prescribing medication for blood pressure or heart conditions?"
                value={answers.q6}
                onChange={(v) => setAnswer("q6", v)}
              />

              <ParqQuestion
                label="Do you know of any other reason why you should not participate in physical activity?"
                value={answers.q7}
                onChange={(v) => setAnswer("q7", v)}
              />
            </div>

            <hr style={{ borderColor: "rgba(255,255,255,0.08)" }} />

            <div>
              <label className="form-label ia-label">
                Injuries, medical conditions or limitations coaches should know about
              </label>

              <textarea
                className="form-control ia-form-input"
                rows={4}
                placeholder="Optional medical notes..."
                value={medicalNotes}
                onChange={(e) => setMedicalNotes(e.target.value)}
              />
            </div>

            <div>
              <div className="ia-tile-title mb-3">Emergency Contact</div>

              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label ia-label">Contact Name</label>

                  <input
                    type="text"
                    className="form-control ia-form-input"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    required
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label ia-label">Contact Phone</label>

                  <input
                    type="tel"
                    className="form-control ia-form-input"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <hr style={{ borderColor: "rgba(255,255,255,0.08)" }} />

            <div className="form-check">
              <input
                className="form-check-input ia-checkbox"
                type="checkbox"
                id="photosConsent"
                checked={photosConsent}
                onChange={(e) => setPhotosConsent(e.target.checked)}
              />

              <label className="form-check-label" htmlFor="photosConsent">
                I’m happy for photos/videos to be used on Iron Acre Gym social media.
              </label>
            </div>

            <div className="form-check">
              <input
                className="form-check-input ia-checkbox"
                type="checkbox"
                id="consentConfirmed"
                checked={consentConfirmed}
                onChange={(e) => setConsentConfirmed(e.target.checked)}
                required
              />

              <label className="form-check-label" htmlFor="consentConfirmed">
                I confirm that the information provided is accurate to the best of my knowledge. I understand
                participation in physical training carries risk of injury. I agree to follow coach instruction,
                use equipment responsibly and stop exercise if I feel unwell.
              </label>
            </div>

            <div className="row g-2">
              <div className="col-12">
                <label className="form-label ia-label">Full Name</label>

                <input
                  type="text"
                  className="form-control ia-form-input"
                  placeholder="Your full legal name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="col-12">
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
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isAuthed}
                />

                {isAuthed && sessionEmail ? (
                  <div className="small mt-1 text-dim">
                    Linked to <span className="ia-linked-email">{sessionEmail}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <label className="form-label ia-label">Signature</label>

              <div className="ia-signature-wrap">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={180}
                  style={{
                    width: "100%",
                    height: 180,
                    touchAction: "none",
                    display: "block",
                  }}
                />
              </div>

              <div className="d-flex justify-content-end mt-2">
                <button type="button" className="ia-btn-outline" onClick={clearSignature}>
                  Clear
                </button>
              </div>
            </div>

            {error ? (
              <div className="ia-alert ia-alert-red" role="alert">
                {error}
              </div>
            ) : null}

            <button type="submit" className="ia-btn-primary" disabled={busy || !mounted}>
              {busy ? "Submitting..." : "Submit PAR-Q"}
            </button>

            <div className="small text-center text-dim">
              By submitting this form you agree to the{" "}
              <Link href="/termsbership terms and participation waiver</Link>.
            </div>

            <div className="small text-center text-dim">
              Submissions are timestamped automatically. Session link: {sessionId ? `#${sessionId}` : "None"}
            </div>
          </form>
        </section>

        <footer className="text-center small text-dim">
          © {new Date().getFullYear()} Iron Acre Gym · <Link href="/privacycy</Link> ·{" "}
          <Link href="/termsms</Link>
        </footer>
      </main>

      <style jsx>{`
        .text-dim {
          color: var(--ia-muted);
        }

        .ia-label {
          color: rgba(255,255,255,0.86);
          font-weight: var(--ia-fw-semi);
          margin-bottom: 6px;
        }

        .ia-form-input {
          min-height: 46px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.03);
          color: #fff;
        }

        .ia-form-input:focus {
          border-color: rgba(24,255,154,0.45);
          box-shadow: 0 0 0 3px rgba(24,255,154,0.12);
          background: rgba(255,255,255,0.04);
          color: #fff;
        }

        .ia-form-input::placeholder {
          color: rgba(255,255,255,0.38);
        }

        .ia-checkbox:checked {
          background-color: var(--ia-neon);
          border-color: var(--ia-neon);
        }

        .ia-checkbox:focus {
          box-shadow: 0 0 0 3px rgba(24,255,154,0.14);
          border-color: rgba(24,255,154,0.5);
        }

        .ia-alert {
          border-radius: 14px;
          padding: 12px 14px;
          color: #fff;
        }

        .ia-alert-green {
          background: rgba(24,255,154,0.12);
          border: 1px solid rgba(24,255,154,0.28);
        }

        .ia-alert-red {
          background: rgba(255,107,107,0.14);
          border: 1px solid rgba(255,107,107,0.32);
        }

        .ia-signature-wrap {
          border-radius: 14px;
          border: 1px dashed rgba(255,255,255,0.28);
          background: rgba(255,255,255,0.03);
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
  onChange: (v: Answer) => void;
}) {
  const { label, value, onChange } = props;
  const nameId = useId();

  return (
    <div className="d-grid gap-2">
      <label className="form-label mb-1">{label}</label>

      <div className="d-flex gap-3">
        <div className="form-check">
          <input
            className="form-check-input ia-checkbox"
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
            className="form-check-input ia-checkbox"
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

      <style jsx>{`
        .ia-checkbox:checked {
          background-color: var(--ia-neon);
          border-color: var(--ia-neon);
        }

        .ia-checkbox:focus {
          box-shadow: 0 0 0 3px rgba(24,255,154,0.14);
          border-color: rgba(24,255,154,0.5);
        }
      `}</style>
    </div>
  );
}

