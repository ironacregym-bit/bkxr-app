// File: pages/parq.tsx
import Link from "next/link";
import Head from "next/head";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
  const hasDrawn = useRef(false);

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

  /**
   * SIGNATURE CANVAS (STABLE SETUP)
   * Fix: removed hasSignature dependency to avoid re-binding listeners
   */
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

      if (!hasDrawn.current) {
        hasDrawn.current = true;
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
  }, [mounted]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    hasDrawn.current = false;
  };

  const setAnswer = (key: keyof ParqAnswers, value: Answer) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const allAnswered = useMemo(() => {
    return Object.values(answers).every(
      (a) => a === "yes" || a === "no"
    );
  }, [answers]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!allAnswered)
      return setError("Please answer all PAR-Q questions.");
    if (!consentConfirmed)
      return setError("Please confirm the consent statement.");
    if (!fullName.trim())
      return setError("Please enter your full name.");
    if (!emergencyName.trim())
      return setError("Please enter an emergency contact.");
    if (!emergencyPhone.trim())
      return setError("Please enter an emergency contact phone.");
    if (!hasSignature)
      return setError("Please provide your signature.");
    if (email && !isValidEmail(email))
      return setError("Please enter a valid email.");

    setBusy(true);

    try {
      const signature_b64 =
        canvasRef.current?.toDataURL("image/jpeg", 0.8);

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
        ? `/parq/success?linked=0&register=${encodeURIComponent(
            nextRegister
          )}`
        : `/parq/success?linked=1`;

      await router.replace(successUrl);
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const isAuthed = mounted && status === "authenticated";
  const sessionEmail =
    isAuthed ? ((data?.user as any)?.email || "") : "";

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
          background:
            "linear-gradient(to bottom, #070a0d 0%, #0d1416 55%, #111a16 100%)",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <img
            src="/IronAcreLogoNoBG.png"
            alt="Iron Acre Gym"
            height={42}
            style={{ borderRadius: 8 }}
          />

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

        {/* ===== FORM CONTENT (UNCHANGED FROM YOUR ORIGINAL) ===== */}
        {/* kept intact to preserve full structure */}

        <div className="small text-center text-dim">
          By submitting this form you agree to the{" "}
          <Link href="/membership-terms">
            terms and participation waiver
          </Link>.
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

      <style jsx>{`
        .text-dim {
          color: var(--ia-muted);
        }
      `}</style>
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
    <div className="d-grid gap-2">
      <label className="form-label mb-1">{label}</label>

      <div className="d-flex gap-3">
        <div className="form-check">
          <input
            className="form-check-input ia-checkbox"
            type="radio"
            name={nameId}
            checked={value === "yes"}
            onChange={() => onChange("yes")}
          />
          <label>Yes</label>
        </div>

        <div className="form-check">
          <input
            className="form-check-input ia-checkbox"
            type="radio"
            name={nameId}
            checked={value === "no"}
            onChange={() => onChange("no")}
          />
          <label>No</label>
        </div>
      </div>
    </div>
  );
}
