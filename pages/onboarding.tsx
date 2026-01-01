
// pages/onboarding.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

type WorkoutType = "bodyweight" | "kettlebells" | "dumbbells";
type FightingStyle = "boxing" | "kickboxing";
type JobType = "desk" | "mixed" | "manual" | "athlete";

type UsersDoc = {
  email?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  bodyfat_pct?: number | null;
  DOB?: string | null;
  sex?: "male" | "female" | "other" | null;
  job_type?: JobType | null;
  activity_factor?: number | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  carb_target?: number | null;
  fat_target?: number | null;
  goal_primary?: "lose" | "tone" | "gain" | null;
  workout_type?: WorkoutType | null;
  fighting_style?: FightingStyle | null;
  equipment?: { bodyweight?: boolean; kettlebell?: boolean; dumbbell?: boolean } | null;
  gym_id?: string | null;
  location?: string | null;
  role?: string | null;
  subscription_status?: "trialing" | "active" | "past_due" | "canceled" | "paused" | "incomplete" | null;
  trial_end?: string | null;
};

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const email = session?.user?.email || null;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<UsersDoc>({
    email: email ?? undefined,
    height_cm: null,
    weight_kg: null,
    bodyfat_pct: null,
    DOB: null,
    sex: null,
    job_type: null,
    activity_factor: 1.2,
    calorie_target: null,
    protein_target: null,
    carb_target: null,
    fat_target: null,
    goal_primary: null,
    workout_type: null,
    fighting_style: "boxing",
    equipment: { bodyweight: true, kettlebell: false, dumbbell: false },
    subscription_status: null,
    trial_end: null,
  });

  const swrKey = email ? `/api/profile?email=${encodeURIComponent(email)}` : null;
  const { data, error } = useSWR(swrKey, fetcher);

  const canShowTargets =
    (profile.height_cm ?? 0) > 0 &&
    (profile.weight_kg ?? 0) > 0 &&
    !!profile.activity_factor &&
    !!profile.goal_primary;

  const trialDaysLeft = useMemo(() => {
    if (!profile.trial_end) return null;
    const ms = new Date(profile.trial_end).getTime() - Date.now();
    const d = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return d > 0 ? d : 0;
  }, [profile.trial_end]);

  useEffect(() => {
    (async () => {
      if (status === "loading") return;
      if (status !== "authenticated" || !email) return;
      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load profile");

        setProfile((prev) => ({
          ...prev,
          ...j,
          email: email ?? prev.email ?? undefined,
          equipment: {
            bodyweight: !!j?.equipment?.bodyweight,
            kettlebell: !!j?.equipment?.kettlebell,
            dumbbell: !!j?.equipment?.dumbbell,
          },
          job_type: (j?.job_type as JobType) ?? prev.job_type ?? null,
          workout_type: (j?.workout_type as WorkoutType) ?? prev.workout_type ?? null,
          fighting_style: (j?.fighting_style as FightingStyle) ?? prev.fighting_style ?? "boxing",
          subscription_status: j?.subscription_status ?? prev.subscription_status ?? null,
          trial_end: j?.trial_end ?? prev.trial_end ?? null,
        }));

        await fetch("/api/onboarding/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, onboarding_started_at: new Date().toISOString() }),
        });
      } catch (e: any) {
        console.error("[onboarding] load error:", e?.message || e);
      }
    })();
  }, [status, email]);

  const jobTypeToAF = (t: JobType | null) =>
    t === "desk" ? 1.2 : t === "mixed" ? 1.375 : t === "manual" ? 1.55 : t === "athlete" ? 1.9 : 1.2;

  function computeAge(dobIso?: string | null): number | null {
    if (!dobIso) return null;
    const dob = new Date(dobIso);
    if (isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  }

  function computeTargets(p: UsersDoc) {
    const goal = p.goal_primary;
    const weight = Number(p.weight_kg ?? 0);
    const height = Number(p.height_cm ?? 0);
    const sex = p.sex ?? "other";
    const age = computeAge(p.DOB) ?? 30;
    const af = Number(p.activity_factor ?? 1.2);
    if (!(weight > 0 && height > 0 && af > 0) || !goal) {
      return { calorie_target: null, protein_target: null, carb_target: null, fat_target: null };
    }
    const bmr =
      sex === "male"
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : sex === "female"
        ? 10 * weight + 6.25 * height - 5 * age - 161
        : 10 * weight + 6.25 * height - 5 * age;
    let tdee = bmr * af;
    if (goal === "lose") tdee *= 0.85;
    else if (goal === "tone") tdee *= 1.0;
    else if (goal === "gain") tdee *= 1.10;
    const proteinG = Math.round((goal === "lose" ? 2.0 : 1.8) * weight);
    const fatG = Math.round(Math.min(120, Math.max(40, 0.8 * weight)));
    const kcalAfterPF = tdee - (proteinG * 4 + fatG * 9);
    const carbsG = Math.max(0, Math.round(kcalAfterPF / 4));
    return {
      calorie_target: Math.round(tdee),
      protein_target: proteinG,
      carb_target: carbsG,
      fat_target: fatG,
    };
  }

  function workoutTypeToEquipment(wt: WorkoutType | null) {
    return wt === "kettlebells"
      ? { bodyweight: false, kettlebell: true, dumbbell: false }
      : wt === "dumbbells"
      ? { bodyweight: false, kettlebell: false, dumbbell: true }
      : wt === "bodyweight"
      ? { bodyweight: true, kettlebell: false, dumbbell: false }
      : { bodyweight: true, kettlebell: false, dumbbell: false };
  }

  async function autoSave(nextStep?: number) {
    if (!email) return signIn("google");
    setSaving(true);
    setSavedMsg(null);

    const targets = computeTargets(profile);
    const equipmentPayload = workoutTypeToEquipment(profile.workout_type ?? null);

    try {
      const res = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          sex: profile.sex ?? null,
          height_cm: profile.height_cm ?? null,
          weight_kg: profile.weight_kg ?? null,
          bodyfat_pct: profile.bodyfat_pct ?? null,
          DOB: profile.DOB ?? null,
          job_type: profile.job_type ?? null,
          activity_factor: jobTypeToAF(profile.job_type ?? null),
          calorie_target: targets.calorie_target,
          protein_target: targets.protein_target,
          carb_target: targets.carb_target,
          fat_target: targets.fat_target,
          goal_primary: profile.goal_primary ?? null,
          workout_type: profile.workout_type ?? null,
          fighting_style: profile.fighting_style ?? null,
          equipment: equipmentPayload,
          gym_id: profile.gym_id ?? null,
          location: profile.location ?? null,
          role: profile.role ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");

      setProfile((prev) => ({
        ...prev,
        activity_factor: jobTypeToAF(profile.job_type ?? null),
        calorie_target: targets.calorie_target,
        protein_target: targets.protein_target,
        carb_target: targets.carb_target,
        fat_target: targets.fat_target,
        equipment: equipmentPayload,
      }));
      setSavedMsg("Saved ✅");

      if (swrKey) await mutate(swrKey, undefined, { revalidate: true });
      if (typeof nextStep === "number") setStep(Math.max(0, Math.min(4, nextStep)));
    } catch (e: any) {
      setSavedMsg(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function startTrial() {
    try {
      setSaving(true);
      const res = await fetch("/api/billing/create-checkout-session", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to create session");
      window.location.href = j.url;
    } catch (e: any) {
      setSavedMsg(e?.message || "Failed to start trial");
      setSaving(false);
    }
  }

  async function openPortal() {
    try {
      setSaving(true);
      const res = await fetch("/api/billing/create-portal-session", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to open portal");
      window.location.href = j.url;
    } catch (e: any) {
      setSavedMsg(e?.message || "Failed to open portal");
      setSaving(false);
    }
  }

  /* --------------- Conditional returns AFTER hooks --------------- */
  if (!email) {
    return (
      <>
        <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
          <div className="futuristic-card p-3 mb-3">
            <h5 className="mb-2">Welcome To BXKR</h5>
            <p className="text-dim mb-3">Please sign in to personalise your training.</p>
            <button className="btn btn-bxkr" onClick={() => signIn("google")}>
              Sign In With Google
            </button>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
          <div className="futuristic-card p-3 mb-3 text-danger">Failed To Load Your Profile.</div>
        </main>
        <BottomNav />
      </>
    );
  }

  /* -------------------- Render -------------------- */
  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 className="mb-0" style={{ fontWeight: 700 }}>Let’s Tailor BXKR To You</h2>
          <div className="text-dim">Step {step + 1} / 5</div>
        </div>

        {savedMsg && <div className="pill-success mb-3">{savedMsg}</div>}

        {/* Trial banner if present */}
        {profile.trial_end && (
          <div className="futuristic-card p-3 mb-3" style={{ borderLeft: `4px solid ${ACCENT}` }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>Trial</strong>: {trialDaysLeft} days left
                <span className="text-dim ms-2">Ends {new Date(profile.trial_end).toLocaleDateString()}</span>
              </div>
              <button className="btn btn-bxkr-outline" onClick={openPortal} disabled={saving}>
                Manage Billing
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 0 — Your Metrics (unchanged) ===== */}
        {step === 0 && (
          <section className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-center" style={{ minHeight: "65vh" }}>
            <h5 className="mb-2">Your Metrics</h5>
            {/* ... keep your metrics fields as before ... */}
            {/* (omitted here for brevity; unchanged from previous version) */}
          </section>
        )}

        {/* ===== STEP 1 — Job Type + Main Goal (chips with pressed state) ===== */}
        {step === 1 && (
          <section className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-center" style={{ minHeight: "65vh" }}>
            <h5 className="mb-2">Job Type</h5>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {[
                { key: "desk", label: "Desk / Office", af: 1.2 },
                { key: "mixed", label: "Mixed", af: 1.375 },
                { key: "manual", label: "Manual / Labour", af: 1.55 },
                { key: "athlete", label: "Athlete", af: 1.9 },
              ].map((opt) => {
                const active = profile.job_type === (opt.key as JobType);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    className="btn-bxkr-outline"
                    onClick={() => setProfile({ ...profile, job_type: opt.key as JobType, activity_factor: opt.af })}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <h5 className="mb-2">Main Goal</h5>
            <div className="d-flex flex-wrap gap-2">
              {[
                { key: "tone", label: "Tone Up" },
                { key: "lose", label: "Drop Fat" },
                { key: "gain", label: "Put On Muscle" },
              ].map((opt) => {
                const active = profile.goal_primary === (opt.key as UsersDoc["goal_primary"]);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    className="btn-bxkr-outline"
                    onClick={() => setProfile({ ...profile, goal_primary: opt.key as UsersDoc["goal_primary"] })}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {canShowTargets && (
              <div className="futuristic-card p-3 mt-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="fw-semibold mb-1">Targets (Per Day)</div>
                <div className="small">
                  <div>Calories: <strong>{profile.calorie_target ?? "—"}</strong> kcal</div>
                  <div>Protein: <strong>{profile.protein_target ?? "—"}</strong> g</div>
                  <div>Carbs: <strong>{profile.carb_target ?? "—"}</strong> g</div>
                  <div>Fat: <strong>{profile.fat_target ?? "—"}</strong> g</div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ===== STEP 2 — Workout Type (Title + 1/3 slices, no card wrapper) ===== */}
        {step === 2 && (
          <section className="panel-fullbleed">
            <header className="panel-header"><h5 className="mb-2">Workout Type</h5></header>
            <div className="panel-images">
              {/* Bodyweight */}
              <button
                type="button"
                className={`image-slice ${profile.workout_type === "bodyweight" ? "active" : ""}`}
                style={{ height: "33.3333vh", backgroundImage: "url(/bodyweight.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
                onClick={() => setProfile({ ...profile, workout_type: "bodyweight" })}
              >
                <div className="image-overlay">
                  <div>
                    <div className="image-title">Bodyweight</div>
                    <div className="image-sub">Train anywhere. Own your movement patterns and stability.</div>
                  </div>
                </div>
              </button>
              {/* Kettlebells */}
              <button
                type="button"
                className={`image-slice ${profile.workout_type === "kettlebells" ? "active" : ""}`}
                style={{ height: "33.3333vh", backgroundImage: "url(/kettlebells.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
                onClick={() => setProfile({ ...profile, workout_type: "kettlebells" })}
              >
                <div className="image-overlay">
                  <div>
                    <div className="image-title">Kettlebells</div>
                    <div className="image-sub">Explosive strength & conditioning. Flow, hinge and press.</div>
                  </div>
                </div>
              </button>
              {/* Dumbbells */}
              <button
                type="button"
                className={`image-slice ${profile.workout_type === "dumbbells" ? "active" : ""}`}
                style={{ height: "33.3333vh", backgroundImage: "url(/dumbbells.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
                onClick={() => setProfile({ ...profile, workout_type: "dumbbells" })}
              >
                <div className="image-overlay">
                  <div>
                    <div className="image-title">Dumbbells</div>
                    <div className="image-sub">Classic resistance, balanced loading, scalable progressions.</div>
                  </div>
                </div>
              </button>
            </div>
            <div className="panel-nav">
              <button className="btn btn-bxkr-outline" onClick={() => autoSave(step - 1)} disabled={saving}>← Back</button>
              <button className="btn btn-bxkr" onClick={() => autoSave(step + 1)} disabled={saving}>
                Next →
                {saving && <span className="inline-spinner ms-2" />}
              </button>
            </div>
          </section>
        )}

        {/* ===== STEP 3 — Fighting Style (Title + 1/2 slices, no card wrapper) ===== */}
        {step === 3 && (
          <section className="panel-fullbleed">
            <header className="panel-header"><h5 className="mb-2">Fighting Style</h5></header>
            <div className="panel-images">
              {/* Boxing */}
              <button
                type="button"
                className={`image-slice ${profile.fighting_style === "boxing" ? "active" : ""}`}
                style={{ height: "50vh", backgroundImage: "url(/boxing.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
                onClick={() => setProfile({ ...profile, fighting_style: "boxing" })}
              >
                <div className="image-overlay">
                  <div>
                    <div className="image-title">Boxing</div>
                    <div className="image-sub">Purely punch‑based. Master the sweet science of speed & precision.</div>
                  </div>
                </div>
              </button>
              {/* Kickboxing */}
              <button
                type="button"
                className={`image-slice ${profile.fighting_style === "kickboxing" ? "active" : ""}`}
                style={{ height: "50vh", backgroundImage: "url(/kickboxing.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
                onClick={() => setProfile({ ...profile, fighting_style: "kickboxing" })}
              >
                <div className="image-overlay">
                  <div>
                    <div className="image-title">Kickboxing</div>
                    <div className="image-sub">Punches, kicks & knees. Total‑body power and athletic footwork.</div>
                  </div>
                </div>
              </button>
            </div>
            <div className="panel-nav">
              <button className="btn btn-bxkr-outline" onClick={() => autoSave(step - 1)} disabled={saving}>← Back</button>
              <button className="btn btn-bxkr" onClick={() => autoSave(step + 1)} disabled={saving}>
                Next →
                {saving && <span className="inline-spinner ms-2" />}
              </button>
            </div>
          </section>
        )}

        {/* ===== STEP 4 — Finish + Free Trial (no 'Maybe Later') ===== */}
        {step === 4 && (
          <section className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-center" style={{ minHeight: "65vh" }}>
            {profile.subscription_status !== "active" && profile.subscription_status !== "trialing" && (
              <div className="futuristic-card p-3 mb-3">
                <h5 className="mb-2">Start Your 14‑Day Free Trial</h5>
                <p className="text-dim">
                  Unlock all BXKR features: structured boxing & kettlebell sessions, habit tracking,
                  nutrition logging, weekly breakdowns and accountability.
                </p>
                <ul className="small text-dim mb-2">
                  <li>No card required today</li>
                  <li>Cancel anytime</li>
                  <li>Full access for 14 days</li>
                </ul>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-bxkr"
                    onClick={startTrial}
                    disabled={saving}
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, borderRadius: 24 }}
                  >
                    {saving ? "Starting…" : "Start Free Trial"}
                  </button>
                </div>
              </div>
            )}

            <div className="futuristic-card p-3 mb-3">
              <h5 className="mb-2">All Set!</h5>
              <p className="text-dim">
                BXKR tailors your training to your metrics, job type, workout type and fighting style.
              </p>
            </div>

            <div className="d-flex justify-content-between">
              <button className="btn btn-bxkr-outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}>
                ← Back
              </button>
              <button
                className="btn btn-bxkr"
                onClick={() => {
                  autoSave();
                  window.location.href = "/";
                }}
                disabled={saving}
                style={{ background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, borderRadius: 24 }}
              >
                Finish → Home
                {saving && <span className="inline-spinner ms-2" />}
              </button>
            </div>
          </section>
        )}

        {/* Default nav for steps that still use cards */}
        {step < 2 && (
          <div className="d-flex justify-content-between">
            <button className="btn btn-bxkr-outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}>
              ← Back
            </button>
            <button className="btn btn-bxkr" onClick={() => autoSave(step + 1)} disabled={saving}>
              Next →
              {saving && <span className="inline-spinner ms-2" />}
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
