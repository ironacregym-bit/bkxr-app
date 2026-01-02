
// pages/onboarding.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import { useAvailableHeight } from "../components/Onboarding/useAvailableHeight";
import StepMetrics from "../components/Onboarding/StepMetrics";
import StepJobGoal from "../components/Onboarding/StepJobGoal";
import StepWorkoutType from "../components/Onboarding/StepWorkoutType";
import StepFightingStyle from "../components/Onboarding/StepFightingStyle";
import StepFinishTrial from "../components/Onboarding/StepFinishTrial";
import type { UsersDoc, JobType } from "../components/Onboarding/types";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const email = session?.user?.email || null;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState<boolean>(false);

  const markDirty = () => {
    setUnsaved(true);
    setSavedMsg(null);
  };

  const [profile, setProfileState] = useState<UsersDoc>({
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

  const setProfile = (updater: (p: UsersDoc) => UsersDoc) => {
    setProfileState((prev) => updater(prev));
  };

  const swrKey = email ? `/api/profile?email=${encodeURIComponent(email)}` : null;
  const { data, error } = useSWR(swrKey, fetcher);

  // Compute targets on demand
  const targets = useMemo(() => {
    const goal = profile.goal_primary;
    const weight = Number(profile.weight_kg ?? 0);
    const height = Number(profile.height_cm ?? 0);
    const af = Number(profile.activity_factor ?? 1.2);
    const sex = profile.sex ?? "other";

    if (!(weight > 0 && height > 0 && af > 0) || !goal) {
      return { calorie_target: null, protein_target: null, carb_target: null, fat_target: null };
    }

    const age = (() => {
      if (!profile.DOB) return 30;
      const dob = new Date(profile.DOB);
      if (isNaN(dob.getTime())) return 30;
      const now = new Date();
      let a = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) a--;
      return a;
    })();

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
  }, [profile.goal_primary, profile.weight_kg, profile.height_cm, profile.activity_factor, profile.sex, profile.DOB]);

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

  const isFirstStep = step <= 0;
  const isLastStep = step >= 4;

  // Measure available height for full-bleed steps (2, 3)
  const availableHeight = useAvailableHeight("onb-header", "onb-page-nav");

  /* ---- Prefill, ensure activity_factor is persisted ---- */
  useEffect(() => {
    (async () => {
      if (status === "loading") return;
      if (status !== "authenticated" || !email) return;

      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load profile");

        setProfileState((prev) => ({
          ...prev,
          ...j,
          email: email ?? prev.email ?? undefined,
          equipment: {
            bodyweight: !!j?.equipment?.bodyweight,
            kettlebell: !!j?.equipment?.kettlebell,
            dumbbell: !!j?.equipment?.dumbbell,
          },
          // trust activity_factor if present; derive job_type if missing
          activity_factor: j?.activity_factor ?? prev.activity_factor ?? 1.2,
          job_type:
            j?.job_type ??
            (function mapAFtoJob(af?: number | null): JobType | null {
              const v = Number(af ?? 1.2);
              if (Math.abs(v - 1.2) < 0.01) return "desk";
              if (Math.abs(v - 1.375) < 0.01) return "mixed";
              if (Math.abs(v - 1.55) < 0.01) return "manual";
              if (Math.abs(v - 1.9) < 0.01) return "athlete";
              return null;
            })(j?.activity_factor),
          workout_type: j?.workout_type ?? prev.workout_type ?? null,
          fighting_style: j?.fighting_style ?? prev.fighting_style ?? "boxing",
          subscription_status: j?.subscription_status ?? prev.subscription_status ?? null,
          trial_end: j?.trial_end ?? prev.trial_end ?? null,
        }));

        // Mark onboarding started (idempotent)
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

  async function autoSave(nextStep?: number) {
    if (!email) return signIn("google");
    setSaving(true);

    try {
      const res = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          // metrics
          sex: profile.sex ?? null,
          height_cm: profile.height_cm ?? null,
          weight_kg: profile.weight_kg ?? null,
          bodyfat_pct: profile.bodyfat_pct ?? null,
          DOB: profile.DOB ?? null,
          // job type → activity_factor
          job_type: profile.job_type ?? null,
          activity_factor: profile.activity_factor ?? 1.2,
          // targets (calculated)
          calorie_target: targets.calorie_target,
          protein_target: targets.protein_target,
          carb_target: targets.carb_target,
          fat_target: targets.fat_target,
          // goals
          goal_primary: profile.goal_primary ?? null,
          // new choices
          workout_type: profile.workout_type ?? null,
          fighting_style: profile.fighting_style ?? null,
          // legacy equipment
          equipment: deriveEquipment(profile.workout_type ?? null),
          // passthrough
          gym_id: profile.gym_id ?? null,
          location: profile.location ?? null,
          role: profile.role ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");

      setProfileState((prev) => ({
        ...prev,
        calorie_target: targets.calorie_target,
        protein_target: targets.protein_target,
        carb_target: targets.carb_target,
        fat_target: targets.fat_target,
        equipment: deriveEquipment(profile.workout_type ?? null),
      }));
      setUnsaved(false);
      setSavedMsg("Saved ✅");

      if (swrKey) await mutate(swrKey, undefined, { revalidate: true });
      if (typeof nextStep === "number") setStep(Math.max(0, Math.min(4, nextStep)));
    } catch (e: any) {
      setSavedMsg(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function deriveEquipment(wt: UsersDoc["workout_type"] | null) {
    return wt === "kettlebells"
      ? { bodyweight: false, kettlebell: true, dumbbell: false }
      : wt === "dumbbells"
      ? { bodyweight: false, kettlebell: false, dumbbell: true }
      : wt === "bodyweight"
      ? { bodyweight: true, kettlebell: false, dumbbell: false }
      : { bodyweight: true, kettlebell: false, dumbbell: false };
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

  /* --------------- Guards --------------- */
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
      {/* Header block includes step title so availableHeight excludes it */}
      <header id="onb-header" className="container py-2" style={{ color: "#fff" }}>
        <div className="d-flex align-items-center justify-content-between">
          <h2 className="mb-0" style={{ fontWeight: 700 }}>Let’s Tailor BXKR To You</h2>
          <div className="text-dim">Step {step + 1} / 5</div>
        </div>

        <div className="mt-2">
          {unsaved ? (
            <span
              className="bxkr-chip"
              style={{
                borderColor: ACCENT,
                color: "#fff",
                boxShadow: "0 0 10px rgba(255,122,26,0.5)",
              }}
            >
              Unsaved changes
            </span>
          ) : (
            savedMsg && <div className="pill-success">{savedMsg}</div>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="container py-2" style={{ color: "#fff" }}>
        {step === 0 && (
          <StepMetrics profile={profile} setProfile={setProfile} markDirty={markDirty} />
        )}

        {step === 1 && (
          <StepJobGoal
            profile={profile}
            setProfile={setProfile}
            markDirty={markDirty}
            canShowTargets={canShowTargets}
            targets={targets}
          />
        )}

        {step === 2 && (
          <StepWorkoutType
            profile={profile}
            setProfile={setProfile}
            markDirty={markDirty}
            availableHeight={availableHeight}
          />
        )}

        {step === 3 && (
          <StepFightingStyle
            profile={profile}
            setProfile={setProfile}
            markDirty={markDirty}
            availableHeight={availableHeight}
          />
        )}

        {step === 4 && (
          <StepFinishTrial
            subscription_status={profile.subscription_status ?? null}
            saving={saving}
            startTrial={startTrial}
            finish={() => {
              autoSave();
              window.location.href = "/";
            }}
            ACCENT={ACCENT}
            isFirstStep={isFirstStep}
            back={() => setStep((s) => Math.max(0, s - 1))}
          />
        )}

        {/* Page-level Back/Next for steps 0 & 1 (card-based) */}
        {(step === 0 || step === 1) && (
          <div className="d-flex justify-content-between" id="onb-page-nav">
            <button
              className="btn btn-bxkr-outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={isFirstStep || saving}
            >
              ← Back
            </button>
            <button className="btn btn-bxkr" onClick={() => autoSave(step + 1)} disabled={saving}>
              Next →
              {saving && <span className="inline-spinner ms-2" />}
            </button>
          </div>
        )}

        {/* Page-level Back/Next for steps 2 & 3 (full-bleed). Sticky, safe-area aware. */}
        {(step === 2 || step === 3) && (
          <div
            className="d-flex justify-content-between"
            id="onb-page-nav"
            style={{
              position: "sticky",
              bottom: 0,
              paddingTop: 10,
              paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.65) 100%)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              zIndex: 5,
            }}
          >
            <button
              className="btn btn-bxkr-outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={isFirstStep || saving}
            >
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
