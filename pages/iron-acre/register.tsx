// pages/iron-acre/register.tsx 
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import {
  IRON_ACRE_MEDIA_CONSENT_LABEL,
  IRON_ACRE_MEMBERSHIP_TERMS,
  IRON_ACRE_TERMS_VERSION,
  IRON_ACRE_LIABILITY_WAIVER,
  IRON_ACRE_WAIVER_VERSION,
} from "../../lib/iron-acre-legal";

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

type RegistrationPayload = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address?: string;
  emergencyContact: {
    name: string;
    phone: string;
  };
  parq: {
    q1: boolean;
    q2: boolean;
    q3: boolean;
    q4: boolean;
    q5: boolean;
    q6: boolean;
    q7: boolean;
    medicalNotes: string;
    requiresMedicalReview: boolean;
  };
  mediaConsent: boolean;
  termsAccepted: boolean;
  termsVersion: string;
  waiverAccepted: boolean;
  waiverVersion: string;
  signedName: string;
  signature_b64: string;
  deviceType: string;
};

const PARQ_QUESTIONS: Array<{ key: keyof ParqAnswers; label: string }> = [
  {
    key: "q1",
    label: "Has your doctor ever said that you have a heart condition or high blood pressure?",
  },
  {
    key: "q2",
    label: "Do you feel pain in your chest when you perform physical activity?",
  },
  {
    key: "q3",
    label: "In the past month, have you had chest pain when you were not doing physical activity?",
  },
  {
    key: "q4",
    label: "Do you lose balance because of dizziness or do you ever lose consciousness?",
  },
  {
    key: "q5",
    label: "Do you have a bone or joint problem that could be made worse by a change in your physical activity?",
  },
  {
    key: "q6",
    label: "Is your doctor currently prescribing drugs for blood pressure or heart conditions?",
  },
  {
    key: "q7",
    label: "Do you know of any other reason why you should not do physical activity?",
  },
];

type StepKey =
  | "personal"
  | "emergency"
  | "parq"
  | "media"
  | "terms"
  | "waiver"
  | "signature";

const STEPS: Array<{ key: StepKey; title: string; subtitle: string }> = [
  {
    key: "personal",
    title: "Personal details",
    subtitle: "Capture the member’s core profile information.",
  },
  {
    key: "emergency",
    title: "Emergency contact",
    subtitle: "Record who should be contacted if needed.",
  },
  {
    key: "parq",
    title: "PAR-Q",
    subtitle: "Health readiness screening before participation.",
  },
  {
    key: "media",
    title: "Photo and media consent",
    subtitle: "Choose whether photos and videos can be used.",
  },
  {
    key: "terms",
    title: "Membership terms",
    subtitle: "Read and accept the current membership terms.",
  },
  {
    key: "waiver",
    title: "Liability waiver",
    subtitle: "Read and accept the participation waiver.",
  },
  {
    key: "signature",
    title: "Signature",
    subtitle: "Capture printed name and digital signature.",
  },
];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  const cleaned = value.replace(/[^\d+]/g, "");
  return cleaned.length >= 9;
}

function isValidDob(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const d = new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  if (d > now) return false;

  const ageMs = now.getTime() - d.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);

  return ageYears >= 12;
}

function getDeviceType() {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes("ipad")) return "ipad";
  if (ua.includes("tablet")) return "tablet";
  if (ua.includes("iphone") || ua.includes("android")) return "mobile";
  return "desktop";
}

function answerToBool(value: Answer) {
  return value === "yes";
}

function stepIndex(key: StepKey) {
  return STEPS.findIndex((s) => s.key === key);
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

export default function IronAcreRegisterPage() {
  const { data: session, status } = useSession();

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<StepKey>("personal");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMemberId, setSuccessMemberId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");

  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const [answers, setAnswers] = useState<ParqAnswers>({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q6: "",
    q7: "",
  });
  const [medicalNotes, setMedicalNotes] = useState("");

  const [mediaConsent, setMediaConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  const [signedName, setSignedName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    const sessionName = String((session?.user as any)?.name || "").trim();
    const sessionEmail = String(session?.user?.email || "").trim();

    if (sessionName && !fullName) {
      setFullName(sessionName);
    }

    if (sessionEmail && !email) {
      setEmail(sessionEmail);
    }
  }, [status, session, fullName, email]);

  useEffect(() => {
    if (!signedName.trim() && fullName.trim()) {
      setSignedName(fullName.trim());
    }
  }, [fullName, signedName]);

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";

    const getPos = (evt: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();

      return {
        x: (evt.clientX - rect.left) * (canvas.width / rect.width),
        y: (evt.clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const onPointerDown = (evt: PointerEvent) => {
      evt.preventDefault();
      drawingRef.current = true;

      const { x, y } = getPos(evt);
      ctx.beginPath();
      ctx.moveTo(x, y);

      try {
        canvas.setPointerCapture(evt.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (evt: PointerEvent) => {
      if (!drawingRef.current) return;

      evt.preventDefault();

      const { x, y } = getPos(evt);
      ctx.lineTo(x, y);
      ctx.stroke();

      if (!hasSignature) {
        setHasSignature(true);
      }
    };

    const onPointerUp = (evt: PointerEvent) => {
      if (!drawingRef.current) return;

      evt.preventDefault();
      drawingRef.current = false;

      try {
        canvas.releasePointerCapture(evt.pointerId);
      } catch {
        // ignore
      }

      setHasSignature(canvasHasInk(canvas));
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
    };
  }, [mounted, hasSignature]);

  const requiresMedicalReview = useMemo(() => {
    return Object.values(answers).includes("yes");
  }, [answers]);

  const allParqAnswered = useMemo(() => {
    return Object.values(answers).every((a) => a === "yes" || a === "no");
  }, [answers]);

  function setAnswer(key: keyof ParqAnswers, value: Answer) {
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function validateStep(targetStep: StepKey) {
    if (targetStep === "personal") {
      if (!fullName.trim()) return "Please enter the member’s full name.";
      if (!email.trim()) return "Please enter the member’s email address.";
      if (!isValidEmail(email.trim())) return "Please enter a valid email address.";
      if (!phone.trim()) return "Please enter the member’s phone number.";
      if (!isValidPhone(phone.trim())) return "Please enter a valid phone number.";
      if (!dateOfBirth.trim()) return "Please enter the member’s date of birth.";
      if (!isValidDob(dateOfBirth.trim())) return "Please enter a valid date of birth.";
    }

    if (targetStep === "emergency") {
      if (!emergencyName.trim()) return "Please enter the emergency contact name.";
      if (!emergencyPhone.trim()) return "Please enter the emergency contact phone number.";
      if (!isValidPhone(emergencyPhone.trim())) {
        return "Please enter a valid emergency contact phone number.";
      }
    }

    if (targetStep === "parq") {
      if (!allParqAnswered) return "Please answer all PAR-Q questions.";
      if (requiresMedicalReview && !medicalNotes.trim()) {
        return "Please provide additional information for the medical review.";
      }
    }

    if (targetStep === "terms") {
      if (!termsAccepted) return "Please accept the Membership Terms to continue.";
    }

    if (targetStep === "waiver") {
      if (!waiverAccepted) return "Please accept the Liability Waiver to continue.";
    }

    if (targetStep === "signature") {
      if (!signedName.trim()) return "Please enter the printed name.";
      if (!canvasHasInk(canvasRef.current)) {
        return "Please provide a signature before submitting.";
      }
    }

    return null;
  }

  function validateAllSteps() {
    for (const stepMeta of STEPS) {
      const validationError = validateStep(stepMeta.key);
      if (validationError) {
        setStep(stepMeta.key);
        return validationError;
      }
    }

    return null;
  }

  function handleNext() {
    setError(null);

    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }

    const currentIndex = stepIndex(step);
    const next = STEPS[currentIndex + 1];
    if (next) {
      setStep(next.key);
    }
  }

  function handleBack() {
    setError(null);

    const currentIndex = stepIndex(step);
    const prev = STEPS[currentIndex - 1];
    if (prev) {
      setStep(prev.key);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const canvas = canvasRef.current;
    if (!canvas) {
      setError("Signature canvas is unavailable.");
      return;
    }

    const validationError = validateAllSteps();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!canvasHasInk(canvas)) {
      setError("Please provide a signature before submitting.");
      return;
    }

    const signature_b64 = canvas.toDataURL("image/jpeg", 0.85);

    const payload: RegistrationPayload = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      dateOfBirth: dateOfBirth.trim(),
      address: address.trim() || undefined,
      emergencyContact: {
        name: emergencyName.trim(),
        phone: emergencyPhone.trim(),
      },
      parq: {
        q1: answerToBool(answers.q1),
        q2: answerToBool(answers.q2),
        q3: answerToBool(answers.q3),
        q4: answerToBool(answers.q4),
        q5: answerToBool(answers.q5),
        q6: answerToBool(answers.q6),
        q7: answerToBool(answers.q7),
        medicalNotes: medicalNotes.trim(),
        requiresMedicalReview,
      },
      mediaConsent,
      termsAccepted,
      termsVersion: IRON_ACRE_TERMS_VERSION,
      waiverAccepted,
      waiverVersion: IRON_ACRE_WAIVER_VERSION,
      signedName: signedName.trim(),
      signature_b64,
      deviceType: getDeviceType(),
    };

    setBusy(true);

    try {
      const res = await fetch("/api/iron-acre/register/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to submit registration"));
      }

      setSuccessMemberId(String(json?.memberId || ""));
    } catch (err: any) {
      setError(err?.message || "Something went wrong while submitting.");
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    const sessionName = String((session?.user as any)?.name || "").trim();
    const sessionEmail = String(session?.user?.email || "").trim();

    setStep("personal");
    setBusy(false);
    setError(null);
    setSuccessMemberId(null);

    setFullName(sessionName || "");
    setEmail(sessionEmail || "");
    setPhone("");
    setDateOfBirth("");
    setAddress("");

    setEmergencyName("");
    setEmergencyPhone("");

    setAnswers({
      q1: "",
      q2: "",
      q3: "",
      q4: "",
      q5: "",
      q6: "",
      q7: "",
    });
    setMedicalNotes("");

    setMediaConsent(false);
    setTermsAccepted(false);
    setWaiverAccepted(false);

    setSignedName(sessionName || "");
    clearSignature();
  }

  const currentStepMeta = STEPS[stepIndex(step)];
  const progressPct = ((stepIndex(step) + 1) / STEPS.length) * 100;

  return (
    <>
      <Head>
        <title>Iron Acre Member Registration</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main
        className="ia-app container py-4"
        style={{
          minHeight: "100vh",
          paddingBottom: 100,
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

          <Link href="/" className="ia-btn ia-btn-muted">
            Back
          </Link>
        </div>

        <section className="mb-4">
          <div className="ia-kicker">Member onboarding</div>
          <h1 className="ia-page-title mt-2">
            Digital registration{" "}
            <span
              style={{
                color: "var(--ia-neon)",
                textShadow: "0 0 16px rgba(24,255,154,0.18)",
                whiteSpace: "nowrap",
              }}
            >
              Iron Acre Gym
            </span>
          </h1>
          <p className="ia-page-subtitle">
            Designed for first-visit onboarding on the gym iPad. Complete all steps once, then link to the member’s account later if needed.
          </p>
        </section>

        {successMemberId ? (
          <section className="ia-tile ia-tile-pad">
            <div className="ia-kicker">
              <i className="fas fa-check-circle" />
              submitted
            </div>
            <div className="ia-page-title mt-2">Registration complete</div>
            <div className="text-dim small mt-2">
              The member registration has been saved successfully.
            </div>

            <div className="mt-3">
              <div className="ia-inline-note-success">Member ID: {successMemberId}</div>
            </div>

            <div className="d-flex flex-wrap gap-2 mt-4">
              <button type="button" className="ia-btn ia-btn-primary" onClick={resetForm}>
                Start another registration
              </button>

              <Link href="/" className="ia-btn ia-btn-muted">
                Return home
              </Link>
            </div>
          </section>
        ) : (
          <form onSubmit={handleSubmit}>
            <section className="ia-tile ia-tile-pad mb-3">
              <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                <div>
                  <div className="ia-card-title-compact">{currentStepMeta.title}</div>
                  <div className="text-dim small mt-1">{currentStepMeta.subtitle}</div>
                </div>

                <div className="ia-badge">
                  Step {stepIndex(step) + 1}/{STEPS.length}
                </div>
              </div>

              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, var(--ia-neon), var(--ia-neon2))",
                  }}
                />
              </div>
            </section>

            <section className="ia-tile ia-tile-pad">
              {step === "personal" ? (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label ia-label">Full name</label>
                    <input
                      type="text"
                      className="form-control ia-form-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full legal name"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label ia-label">Email</label>
                    <input
                      type="email"
                      className="form-control ia-form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="member@example.com"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label ia-label">Phone number</label>
                    <input
                      type="tel"
                      className="form-control ia-form-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label ia-label">Date of birth</label>
                    <input
                      type="date"
                      className="form-control ia-form-input"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label ia-label">Address (optional)</label>
                    <textarea
                      className="form-control ia-form-input"
                      rows={3}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Address"
                    />
                  </div>
                </div>
              ) : null}

              {step === "emergency" ? (
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label ia-label">Emergency contact name</label>
                    <input
                      type="text"
                      className="form-control ia-form-input"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Emergency contact name"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label ia-label">Emergency contact phone</label>
                    <input
                      type="tel"
                      className="form-control ia-form-input"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="Emergency contact phone number"
                      required
                    />
                  </div>
                </div>
              ) : null}

              {step === "parq" ? (
                <div className="d-grid gap-4">
                  <div className="d-grid gap-3">
                    {PARQ_QUESTIONS.map((question) => (
                      <ParqQuestion
                        key={question.key}
                        name={`parq-${question.key}`}
                        label={question.label}
                        value={answers[question.key]}
                        onChange={(v) => setAnswer(question.key, v)}
                      />
                    ))}
                  </div>

                  {requiresMedicalReview ? (
                    <div className="ia-alert ia-alert-green">
                      <div className="fw-semibold mb-2">Please provide additional information</div>
                      <textarea
                        className="form-control ia-form-input"
                        rows={4}
                        value={medicalNotes}
                        onChange={(e) => setMedicalNotes(e.target.value)}
                        placeholder="Medical notes, symptoms, restrictions or anything coaches should know..."
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="form-label ia-label">Medical notes (optional)</label>
                      <textarea
                        className="form-control ia-form-input"
                        rows={4}
                        value={medicalNotes}
                        onChange={(e) => setMedicalNotes(e.target.value)}
                        placeholder="Optional injuries, medical conditions or limitations..."
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {step === "media" ? (
                <div className="d-grid gap-3">
                  <div className="text-dim small">
                    This preference can be changed later if needed.
                  </div>

                  <label
                    className="d-flex align-items-start gap-2"
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <input
                      className="form-check-input ia-checkbox"
                      type="checkbox"
                      checked={mediaConsent}
                      onChange={(e) => setMediaConsent(e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <span>{IRON_ACRE_MEDIA_CONSENT_LABEL}</span>
                  </label>
                </div>
              ) : null}

              {step === "terms" ? (
                <div className="d-grid gap-3">
                  <div className="ia-inline-note-success">
                    Terms version {IRON_ACRE_TERMS_VERSION}
                  </div>

                  <div className="ia-scroll-panel">
                    {IRON_ACRE_MEMBERSHIP_TERMS.map((line, idx) => (
                      <p key={idx} className="ia-copy">
                        {line}
                      </p>
                    ))}
                  </div>

                  <label
                    className="d-flex align-items-start gap-2"
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <input
                      className="form-check-input ia-checkbox"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <span>I have read and agree to the Membership Terms.</span>
                  </label>
                </div>
              ) : null}

              {step === "waiver" ? (
                <div className="d-grid gap-3">
                  <div className="ia-inline-note-success">
                    Waiver version {IRON_ACRE_WAIVER_VERSION}
                  </div>

                  <div className="ia-scroll-panel">
                    {IRON_ACRE_LIABILITY_WAIVER.map((line, idx) => (
                      <p key={idx} className="ia-copy">
                        {line}
                      </p>
                    ))}
                  </div>

                  <label
                    className="d-flex align-items-start gap-2"
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <input
                      className="form-check-input ia-checkbox"
                      type="checkbox"
                      checked={waiverAccepted}
                      onChange={(e) => setWaiverAccepted(e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      I understand that participation in physical training carries inherent risks and I voluntarily participate at my own risk.
                    </span>
                  </label>
                </div>
              ) : null}

              {step === "signature" ? (
                <div className="d-grid gap-3">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label ia-label">Printed name</label>
                      <input
                        type="text"
                        className="form-control ia-form-input"
                        value={signedName}
                        onChange={(e) => setSignedName(e.target.value)}
                        placeholder="Printed name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label ia-label">Digital signature</label>

                    <div className="ia-signature-wrap">
                      <canvas
                        ref={canvasRef}
                        width={900}
                        height={220}
                        style={{
                          width: "100%",
                          height: 220,
                          touchAction: "none",
                          display: "block",
                        }}
                      />
                    </div>

                    <div className="d-flex justify-content-between align-items-center mt-2 gap-2">
                      <div className="text-dim small">
                        Sign with a finger on the iPad or mouse on desktop.
                      </div>

                      <button
                        type="button"
                        className="ia-btn ia-btn-muted"
                        onClick={clearSignature}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="text-dim small">
                    Signature timestamp and device type will be captured automatically when submitted.
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="ia-alert ia-alert-red mt-4" role="alert">
                  {error}
                </div>
              ) : null}

              <div className="d-flex justify-content-between gap-2 flex-wrap mt-4">
                <button
                  type="button"
                  className="ia-btn ia-btn-muted"
                  onClick={handleBack}
                  disabled={stepIndex(step) === 0 || busy}
                >
                  Back
                </button>

                {step !== "signature" ? (
                  <button
                    type="button"
                    className="ia-btn ia-btn-primary"
                    onClick={handleNext}
                    disabled={busy}
                  >
                    Next
                  </button>
                ) : (
                  <button type="submit" className="ia-btn ia-btn-primary" disabled={busy}>
                    {busy ? "Submitting..." : "Complete registration"}
                  </button>
                )}
              </div>
            </section>
          </form>
        )}

        <footer className="text-center small text-dim mt-4">
          © {new Date().getFullYear()} Iron Acre Gym · <Link href="/privacy">Privacy</Link>;
        </footer>

          .ia-form-input {
            min-height: 48px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.03);
            color: #fff;
          }

          .ia-form-input:focus {
            border-color: rgba(24, 255, 154, 0.42);
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

          .ia-alert-red {
            background: rgba(255, 107, 107, 0.14);
            border: 1px solid rgba(255, 107, 107, 0.32);
          }

          .ia-signature-wrap {
            border-radius: 14px;
            border: 1px dashed rgba(255, 255, 255, 0.28);
            background: rgba(255, 255, 255, 0.03);
            overflow: hidden;
          }

          .ia-scroll-panel {
            max-height: 300px;
            overflow-y: auto;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.04);
            padding: 14px;
          }

          .ia-copy {
            color: rgba(255, 255, 255, 0.86);
            line-height: 1.6;
            margin: 0 0 12px;
          }

          .ia-copy:last-child {
            margin-bottom: 0;
          }
        `}</style>
      </main>
    </>
  );
}

function ParqQuestion(props: {
  name: string;
  label: string;
  value: Answer;
  onChange: (v: Answer) => void;
}) {
  const { name, label, value, onChange } = props;

  return (
    <div className="d-grid gap-2">
      <label className="form-label mb-1">{label}</label>

      <div className="d-flex gap-3">
        <div className="form-check">
          <input
            className="form-check-input ia-checkbox"
            type="radio"
            name={name}
            id={`${name}-yes`}
            checked={value === "yes"}
            onChange={() => onChange("yes")}
          />
          <label className="form-check-label" htmlFor={`${name}-yes`}>
            Yes
          </label>
        </div>

        <div className="form-check">
          <input
            className="form-check-input ia-checkbox"
            type="radio"
            name={name}
            id={`${name}-no`}
            checked={value === "no"}
            onChange={() => onChange("no")}
          />
          <label className="form-check-label" htmlFor={`${name}-no`}>
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
          box-shadow: 0 0 0 3px rgba(24, 255, 154, 0.14);
          border-color: rgba(24, 255, 154, 0.5);
        }
      `}</style>
    </div>
  );
}
