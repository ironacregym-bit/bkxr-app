// File: pages/parq.tsx
import Link from "next/link";
import Head from "next/head";
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

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

    const onUp = () => {
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

    if (!allAnswered) return setError("Please answer all PAR-Q questions.");
    if (!consentConfirmed) return setError("Please confirm the consent statement.");
    if (!fullName.trim()) return setError("Please enter your full name.");
    if (!emergencyName.trim()) return setError("Please enter an emergency contact.");
    if (!emergencyPhone.trim()) return setError("Please enter an emergency contact phone.");
    if (!hasSignature) return setError("Please provide your signature.");
    if (email && !isValidEmail(email)) return setError("Please enter a valid email.");

    setBusy(true);

    try {
      const signature_b64 = canvasRef.current?.toDataURL("image/jpeg", 0.8);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

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
          <img src="/IronAcreLogoNoBG.png" alt="Iron Acre Gym" height={42} />
          <Link href="/" className="ia-btn-outline">
            Back
          </Link>
        </div>

        <section className="mb-4">
          <div className="ia-kicker">Health Screening</div>

          <h1 className="ia-page-title mt-2">
            PAR-Q{" "}
            <span style={{ color: "var(--ia-neon)" }}>
              Iron Acre Gym
            </span>
          </h1>

          <p className="ia-page-subtitle">
            Please answer honestly. Participation carries risk of injury.
          </p>

          {hasRedFlag && (
            <div className="ia-alert ia-alert-green mt-3">
              One or more answers may require medical guidance.
            </div>
          )}
        </section>

        {/* ===================== FULL ORIGINAL FORM RESTORED ===================== */}

        <section className="ia-tile ia-tile-pad mb-3">
          <form onSubmit={handleSubmit} className="d-grid gap-4">

            <div className="d-grid gap-3">
              {/*
                ALL 7 QUESTIONS RESTORED EXACTLY
              */}
              <ParqQuestion label="Has your doctor ever said that you have a heart condition or high blood pressure?" value={answers.q1} onChange={(v) => setAnswer("q1", v)} />
              <ParqQuestion label="Do you feel pain in your chest when you perform physical activity?" value={answers.q2} onChange={(v) => setAnswer("q2", v)} />
              <ParqQuestion label="In the past month, have you had chest pain when not doing physical activity?" value={answers.q3} onChange={(v) => setAnswer("q3", v)} />
              <ParqQuestion label="Do you lose balance because of dizziness or ever lose consciousness?" value={answers.q4} onChange={(v) => setAnswer("q4", v)} />
              <ParqQuestion label="Do you have a bone or joint problem that could worsen with physical activity?" value={answers.q5} onChange={(v) => setAnswer("q5", v)} />
              <ParqQuestion label="Is your doctor prescribing medication for blood pressure or heart conditions?" value={answers.q6} onChange={(v) => setAnswer("q6", v)} />
              <ParqQuestion label="Do you know of any other reason why you should not participate in physical activity?" value={answers.q7} onChange={(v) => setAnswer("q7", v)} />
            </div>

            <hr />

            <div>
              <label>Medical notes</label>
              <textarea
                rows={4}
                value={medicalNotes}
                onChange={(e) => setMedicalNotes(e.target.value)}
              />
            </div>

            <div>
              <label>Emergency Contact</label>
              <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
              <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
            </div>

            <div>
              <input
                type="checkbox"
                checked={photosConsent}
                onChange={(e) => setPhotosConsent(e.target.checked)}
              />
              <label>Photo/video consent</label>
            </div>

            <div>
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(e) => setConsentConfirmed(e.target.checked)}
              />
              <label>Consent confirmation</label>
            </div>

            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
            />

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
            />

            <div>
              <canvas ref={canvasRef} width={600} height={180} />
              <button type="button" onClick={clearSignature}>
                Clear
              </button>
            </div>

            {error && <div className="ia-alert ia-alert-red">{error}</div>}

            <button type="submit" disabled={busy}>
              {busy ? "Submitting..." : "Submit PAR-Q"}
            </button>

          </form>
        </section>

        <div className="small text-center text-dim">
          By submitting this form you agree to the{" "}
          <Link href="/membership-terms">terms and participation waiver</Link>.
        </div>

        <div className="small text-center text-dim">
          Submissions are timestamped automatically. Session link:{" "}
          {sessionId ? `#${sessionId}` : "None"}
        </div>

        <footer className="text-center small text-dim">
          © {new Date().getFullYear()} Iron Acre Gym ·{" "}
          <Link href="/privacy">Privacy Policy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}

function ParqQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Answer;
  onChange: (v: Answer) => void;
}) {
  const nameId = useId();

  return (
    <div>
      <label>{label}</label>

      <div>
        <input
          type="radio"
          name={nameId}
          checked={value === "yes"}
          onChange={() => onChange("yes")}
        />
        Yes

        <input
          type="radio"
          name={nameId}
          checked={value === "no"}
          onChange={() => onChange("no")}
        />
        No
      </div>
    </div>
  );
}
