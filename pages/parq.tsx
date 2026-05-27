// /pages/parq.tsx

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

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
  const ACCENT = "#8B5A2B";
  const CARD = "#1A1A1A";

  const { status, data } = useSession();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // PARQ answers
  const [answers, setAnswers] = useState<ParqAnswers>({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q6: "",
    q7: "",
  });

  // Additional fields
  const [photosConsent, setPhotosConsent] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [medicalNotes, setMedicalNotes] = useState("");

  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const [hasSignature, setHasSignature] = useState(false);

  // Session ID
  const sessionId = useMemo(() => {
    if (!mounted) return "";

    const v = router.query.session;

    return typeof v === "string" ? v : "";
  }, [router.query.session, mounted]);

  // Medical review flag
  const hasRedFlag = useMemo(() => {
    return Object.values(answers).includes("yes");
  }, [answers]);

  // Validation helpers
  const isValidEmail = (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // Autofill email
  useEffect(() => {
    if (!mounted) return;

    if (status === "authenticated") {
      const sessionEmail = (data?.user as any)?.email || "";

      if (sessionEmail && !email) {
        setEmail(sessionEmail);
      }
    }
  }, [mounted, status, data?.user, email]);

  // Signature canvas setup
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
    canvas.addEventListener("touchstart", onDown, {
      passive: false,
    });

    canvas.addEventListener("touchmove", onMove, {
      passive: false,
    });

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

  // Clear signature
  const clearSignature = () => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    setHasSignature(false);
  };

  // Set answer helper
  const setAnswer = (
    key: keyof ParqAnswers,
    val: Answer
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  // Validation
  const allAnswered = useMemo(() => {
    return Object.values(answers).every(
      (a) => a === "yes" || a === "no"
    );
  }, [answers]);

  // Submit
  const handleSubmit = async (
    e: FormEvent
  ) => {
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
      let signature_b64: string | undefined =
        undefined;

      if (canvasRef.current) {
        signature_b64 =
          canvasRef.current.toDataURL(
            "image/jpeg",
            0.8
          );
      }

      const payload = {
        answers,

        medical_notes:
          medicalNotes.trim() || undefined,

        emergency_contact_name:
          emergencyName.trim(),

        emergency_contact_phone:
          emergencyPhone.trim(),

        photos_consent: photosConsent,

        consent_confirmed: consentConfirmed,

        signed_name: fullName.trim(),

        provided_email:
          email.trim() || undefined,

        requires_medical_review:
          hasRedFlag,

        session_id:
          sessionId || undefined,

        signature_b64,
      };

      const res = await fetch(
        "/api/parq/submit",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const txt = await res.text();

        throw new Error(
          txt || "Submission failed."
        );
      }

      const showRegisterCta =
        status !== "authenticated";

      const nextRegister =
        "/register?parq=ok";

      const successUrl = showRegisterCta
        ? `/parq/success?linked=0&register=${encodeURIComponent(
            nextRegister
          )}`
        : `/parq/success?linked=1`;

      await router.replace(successUrl);
    } catch (err: any) {
      setError(
        err?.message ||
          "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  };

  const isAuthed =
    mounted &&
    status === "authenticated";

  const sessionEmail = isAuthed
    ? (data?.user as any)?.email || ""
    : "";

  return (
    <>
      <Head>
        <title>PAR-Q • Iron Acre Gym</title>

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </Head>

      <main
        className="container py-4"
        style={{
          paddingBottom: 80,
          color: "#fff",
          minHeight: "100vh",
          background:
            "linear-gradient(to bottom, #0f0f0f 0%, #161616 50%, #1d1a17 100%)",
        }}
      >
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <img
              src="/IronAcreLogoNoBG.png"
              alt="Iron Acre Gym"
              height={42}
              style={{
                borderRadius: 8,
                display: "block",
              }}
            />
          </div>

          <Link
            href="/"
            className="btn-bxkr-outline"
          >
            Back
          </Link>
        </div>

        {/* Intro */}
        <section className="mb-4">
          <h1
            className="fw-bold"
            style={{
              fontSize: "2rem",
              lineHeight: 1.2,
            }}
          >
            Health{" "}
            <span
              style={{
                color: ACCENT,
              }}
            >
              PAR-Q
            </span>
          </h1>

          <p className="text-dim mt-2 mb-0">
            Please answer honestly.
            Participation in physical
            activity carries risk of injury.
          </p>

          {hasRedFlag && (
            <div
              className="alert mt-3"
              style={{
                background:
                  "rgba(139,90,43,0.18)",
                border:
                  "1px solid rgba(139,90,43,0.55)",
                color: "#fff",
                borderRadius: 14,
              }}
            >
              One or more answers may require medical guidance before participating in intense physical activity.
            </div>
          )}
        </section>

        {/* Form */}
        <section
          className="futuristic-card p-3 mb-3"
          style={{
            background: CARD,
            border:
              "1px solid rgba(255,255,255,0.06)",
            borderRadius: 20,
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="d-grid gap-4"
          >
            {/* Questions */}
            <div className="d-grid gap-3">
              <ParqQuestion
                label="Has your doctor ever said you have a heart condition or high blood pressure?"
                value={answers.q1}
                onChange={(v) =>
                  setAnswer("q1", v)
                }
              />

              <ParqQuestion
                label="Do you feel chest pain during physical activity?"
                value={answers.q2}
                onChange={(v) =>
                  setAnswer("q2", v)
                }
              />

              <ParqQuestion
                label="In the past month, have you experienced chest pain while not exercising?"
                value={answers.q3}
                onChange={(v) =>
                  setAnswer("q3", v)
                }
              />

              <ParqQuestion
                label="Do you lose balance due to dizziness or lose consciousness?"
                value={answers.q4}
                onChange={(v) =>
                  setAnswer("q4", v)
                }
              />

              <ParqQuestion
                label="Do you have a bone or joint problem that could worsen with exercise?"
                value={answers.q5}
                onChange={(v) =>
                  setAnswer("q5", v)
                }
              />

              <ParqQuestion
                label="Are you prescribed medication for blood pressure or heart conditions?"
                value={answers.q6}
                onChange={(v) =>
                  setAnswer("q6", v)
                }
              />

              <ParqQuestion
                label="Is there any other reason you should not participate in physical activity?"
                value={answers.q7}
                onChange={(v) =>
                  setAnswer("q7", v)
                }
              />
            </div>

            {/* Medical Notes */}
            <div>
              <label className="form-label">
                Injuries, medical conditions or limitations coaches should know about
              </label>

              <textarea
                className="form-control"
                rows={4}
                placeholder="Optional medical notes..."
                value={medicalNotes}
                onChange={(e) =>
                  setMedicalNotes(e.target.value)
                }
              />
            </div>

            {/* Emergency Contact */}
            <div>
              <h5 className="mb-3">
                Emergency Contact
              </h5>

              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label">
                    Contact Name
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    value={emergencyName}
                    onChange={(e) =>
                      setEmergencyName(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">
                    Contact Phone
                  </label>

                  <input
                    type="tel"
                    className="form-control"
                    value={emergencyPhone}
                    onChange={(e) =>
                      setEmergencyPhone(e.target.value)
                    }
                    required
                  />
                </div>
              </div>
            </div>

            {/* Photo Consent */}
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="photosConsent"
                checked={photosConsent}
                onChange={(e) =>
                  setPhotosConsent(e.target.checked)
                }
              />

              <label
                className="form-check-label"
                htmlFor="photosConsent"
              >
                I’m happy for photos/videos to be used on Iron Acre Gym social media.
              </label>
            </div>

            {/* Liability Consent */}
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="consentConfirmed"
                checked={consentConfirmed}
                onChange={(e) =>
                  setConsentConfirmed(e.target.checked)
                }
                required
              />

              <label
                className="form-check-label"
                htmlFor="consentConfirmed"
              >
                I confirm the information provided is accurate to the best of my knowledge.
                I understand participation in physical training carries risk of injury.
                I agree to follow coach instruction, use equipment responsibly and stop exercise if I feel unwell.
              </label>
            </div>

            {/* Name */}
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label">
                  Full Name
                </label>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Your full legal name"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  required
                />
              </div>

              <div className="col-12">
                <label className="form-label">
                  Email
                </label>

                <input
                  type="email"
                  className="form-control"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  disabled={isAuthed}
                />

                {isAuthed &&
                  sessionEmail && (
                    <div className="small text-dim mt-1">
                      Linked to{" "}
                      <span
                        style={{
                          color: ACCENT,
                        }}
                      >
                        {sessionEmail}
                      </span>
                    </div>
                  )}
              </div>
            </div>

            {/* Signature */}
            <div>
              <label className="form-label">
                Signature
              </label>

              <div
                className="rounded"
                style={{
                  border:
                    "1px dashed rgba(255,255,255,0.3)",
                  background:
                    "rgba(255,255,255,0.05)",
                }}
              >
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
                <button
                  type="button"
                  className="btn-bxkr-outline"
                  onClick={clearSignature}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="alert alert-danger"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="bxkr-btn"
              disabled={
                busy || !mounted
              }
              style={{
                background: ACCENT,
                border: "none",
              }}
            >
              {busy
                ? "Submitting..."
                : "Submit PAR-Q"}
            </button>

            {/* Terms */}
            <div className="small text-dim text-center">
              By submitting this form you agree to the{" "}
              <Link href="/terms">
                membership terms and participation waiver
              </Link>.
            </div>
          </form>
        </section>

        {/* Footer */}
        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} Iron Acre Gym ·{" "}
          <Link href="/privacy">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms">
            Terms
          </Link>
        </footer>
      </main>
    </>
  );
}

function ParqQuestion(props: {
  label: string;
  value: Answer;
  onChange: (v: Answer) => void;
}) {
  const { label, value, onChange } =
    props;

  const nameId = useMemo(
    () =>
      Math.random()
        .toString(36)
        .slice(2),
    []
  );

  return (
    <div className="d-grid gap-2">
      <label className="form-label mb-1">
        {label}
      </label>

      <div className="d-flex gap-3">
        <div className="form-check">
          <input
            className="form-check-input"
            type="radio"
            name={nameId}
            id={`${nameId}-yes`}
            checked={value === "yes"}
            onChange={() =>
              onChange("yes")
            }
          />

          <label
            className="form-check-label"
            htmlFor={`${nameId}-yes`}
          >
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
            onChange={() =>
              onChange("no")
            }
          />

          <label
            className="form-check-label"
            htmlFor={`${nameId}-no`}
          >
            No
          </label>
        </div>
      </div>
    </div>
  );
}