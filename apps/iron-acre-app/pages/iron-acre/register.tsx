// pages/iron-acre/register.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  function getCanvasPoint(evt: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
  
    const rect = canvas.getBoundingClientRect();
  
    return {
      x: (evt.clientX - rect.left) * (canvas.width / rect.width),
      y: (evt.clientY - rect.top) * (canvas.height / rect.height),
    };
  }
  
  function handleSignaturePointerDown(evt: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
  
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
  
    const point = getCanvasPoint(evt);
    if (!point) return;
  
    evt.preventDefault();
    drawingRef.current = true;
  
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";
  
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  
    try {
      canvas.setPointerCapture(evt.pointerId);
    } catch {
      // ignore
    }
  }
  
  function handleSignaturePointerMove(evt: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
  
    const canvas = canvasRef.current;
    if (!canvas) return;
  
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
  
    const point = getCanvasPoint(evt);
    if (!point) return;
  
    evt.preventDefault();
  
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  
    if (!hasSignature) {
      setHasSignature(true);
    }
  }
  
  function finishSignatureStroke(evt?: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
  
    drawingRef.current = false;
  
    if (evt) {
      evt.preventDefault();
  
      try {
        canvas.releasePointerCapture(evt.pointerId);
      } catch {
        // ignore
      }
    }
  
    setHasSignature(canvasHasInk(canvas));
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

      <main className="min-h-screen bg-gradient-to-b from-ia-bg via-ia-bg-alt to-ia-bg px-4 py-6 pb-24 text-foreground sm:py-10">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/iron_acre_logo_transparent.png"
                alt="Iron Acre Gym"
                className="h-12 w-12 object-contain"
              />
              <span className="font-display text-xl font-bold">IRON ACRE</span>
            </div>

            <Link href="/" className="text-sm text-ia-primary hover:underline">
              Back
            </Link>
          </div>

          <section className="mb-8 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ia-primary">Member onboarding</div>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            Digital registration{" "}
            <span className="whitespace-nowrap text-ia-primary">
              Iron Acre Gym
            </span>
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Designed for first-visit onboarding on the gym iPad. Complete all steps once, then link to the member’s account later if needed.
          </p>
        </section>

        {successMemberId ? (
          <Card className="border-ia-border bg-card p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ia-primary">Submitted</div>
            <h2 className="mt-2 font-display text-3xl font-bold">Registration complete</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The member registration has been saved successfully.
            </p>

            <div className="mt-4 rounded-lg border border-ia-sage/30 bg-ia-sage/10 p-3 text-sm">
              Member ID: {successMemberId}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" onClick={resetForm}>
                Start another registration
              </Button>

              <Link href="/" className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm hover:bg-accent">
                Return home
              </Link>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit}>
            <section className="mb-4 rounded-xl border border-ia-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{currentStepMeta.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{currentStepMeta.subtitle}</div>
                </div>

                <div className="rounded-full border border-ia-primary/30 bg-ia-primary/10 px-3 py-1 text-xs font-medium text-ia-primary">
                  Step {stepIndex(step) + 1}/{STEPS.length}
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: "100%",
                  }}
                  className="bg-primary transition-[width]"
                />
              </div>
            </section>

            <section className="rounded-xl border border-ia-border bg-card p-5 shadow-sm sm:p-6">
              {step === "personal" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm font-medium">Full name</label>
                    <Input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full legal name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="member@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Phone number</label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Date of birth</label>
                    <Input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm font-medium">Address (optional)</label>
                    <Textarea
                      rows={3}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Address"
                    />
                  </div>
                </div>
              ) : null}

              {step === "emergency" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Emergency contact name</label>
                    <Input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Emergency contact name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Emergency contact phone</label>
                    <Input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="Emergency contact phone number"
                      required
                    />
                  </div>
                </div>
              ) : null}

              {step === "parq" ? (
                <div className="grid gap-6">
                  <div className="grid gap-4">
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
                    <div className="rounded-lg border border-ia-primary/30 bg-ia-primary/10 p-4">
                      <div className="mb-2 font-semibold">Please provide additional information</div>
                      <Textarea
                        rows={4}
                        value={medicalNotes}
                        onChange={(e) => setMedicalNotes(e.target.value)}
                        placeholder="Medical notes, symptoms, restrictions or anything coaches should know..."
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm font-medium">Medical notes (optional)</label>
                      <Textarea
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
                <div className="grid gap-4">
                  <div className="text-sm text-muted-foreground">
                    This preference can be changed later if needed.
                  </div>

                  <label
                    className="flex cursor-pointer select-none items-start gap-3"
                  >
                    <input
                      className="mt-1 accent-ia-primary"
                      type="checkbox"
                      checked={mediaConsent}
                      onChange={(e) => setMediaConsent(e.target.checked)}
                    />
                    <span>{IRON_ACRE_MEDIA_CONSENT_LABEL}</span>
                  </label>
                </div>
              ) : null}

              {step === "terms" ? (
                <div className="grid gap-4">
                  <div className="rounded-md border border-ia-sage/30 bg-ia-sage/10 p-3 text-sm text-ia-sage">
                    Terms version {IRON_ACRE_TERMS_VERSION}
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background/70 p-4">
                    {IRON_ACRE_MEMBERSHIP_TERMS.map((line, idx) => (
                      <p key={idx} className="mb-3 text-sm leading-6 text-foreground last:mb-0">
                        {line}
                      </p>
                    ))}
                  </div>

                  <label
                    className="flex cursor-pointer select-none items-start gap-3"
                  >
                    <input
                      className="mt-1 accent-ia-primary"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                    />
                    <span>I have read and agree to the Membership Terms.</span>
                  </label>
                </div>
              ) : null}

              {step === "waiver" ? (
                <div className="grid gap-4">
                  <div className="rounded-md border border-ia-sage/30 bg-ia-sage/10 p-3 text-sm text-ia-sage">
                    Waiver version {IRON_ACRE_WAIVER_VERSION}
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background/70 p-4">
                    {IRON_ACRE_LIABILITY_WAIVER.map((line, idx) => (
                      <p key={idx} className="mb-3 text-sm leading-6 text-foreground last:mb-0">
                        {line}
                      </p>
                    ))}
                  </div>

                  <label
                    className="flex cursor-pointer select-none items-start gap-3"
                  >
                    <input
                      className="mt-1 accent-ia-primary"
                      type="checkbox"
                      checked={waiverAccepted}
                      onChange={(e) => setWaiverAccepted(e.target.checked)}
                    />
                    <span>
                      I understand that participation in physical training carries inherent risks and I voluntarily participate at my own risk.
                    </span>
                  </label>
                </div>
              ) : null}

              {step === "signature" ? (
                <div className="grid gap-4">
                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Printed name</label>
                      <Input
                        type="text"
                        value={signedName}
                        onChange={(e) => setSignedName(e.target.value)}
                        placeholder="Printed name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Digital signature</label>

                    <div className="overflow-hidden rounded-lg border border-dashed border-border bg-background/70">
                      <canvas
                        ref={canvasRef}
                        width={900}
                        height={220}
                        onPointerDown={handleSignaturePointerDown}
                        onPointerMove={handleSignaturePointerMove}
                        onPointerUp={finishSignatureStroke}
                        onPointerLeave={finishSignatureStroke}
                        onPointerCancel={finishSignatureStroke}
                        className="block h-[220px] w-full touch-none cursor-crosshair select-none"
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-muted-foreground">
                        Sign with a finger on the iPad or mouse on desktop.
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearSignature}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Signature timestamp and device type will be captured automatically when submitted.
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground" role="alert">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={stepIndex(step) === 0 || busy}
                >
                  Back
                </Button>

                {step !== "signature" ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={busy}
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="submit" disabled={busy}>
                    {busy ? "Submitting..." : "Complete registration"}
                  </Button>
                )}
              </div>
            </section>
          </form>
        )}

        <footer className="mt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Iron Acre Gym · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
        </div>
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
    <div className="grid gap-2">
      <label className="text-sm font-medium">{label}</label>

      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <input
            className="accent-ia-primary"
            type="radio"
            name={name}
            id={`${name}-yes`}
            checked={value === "yes"}
            onChange={() => onChange("yes")}
          />
          <label className="text-sm" htmlFor={`${name}-yes`}>
            Yes
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="accent-ia-primary"
            type="radio"
            name={name}
            id={`${name}-no`}
            checked={value === "no"}
            onChange={() => onChange("no")}
          />
          <label className="text-sm" htmlFor={`${name}-no`}>
            No
          </label>
        </div>
      </div>

    </div>
  );
}
