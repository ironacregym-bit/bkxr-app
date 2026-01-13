
// pages/onboarding.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";
// Removed: useAvailableHeight (not needed after removing Workout Type step)
// import { useAvailableHeight } from "../components/Onboarding/useAvailableHeight";
import StepMetrics from "../components/Onboarding/StepMetrics";
import StepJobGoal from "../components/Onboarding/StepJobGoal";
// Removed: StepWorkoutType
// import StepWorkoutType from "../components/Onboarding/StepWorkoutType";
import StepFinishTrial from "../components/Onboarding/StepFinishTrial";
import type { UsersDoc, JobType } from "../components/Onboarding/types";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

/**
 * Orchestrator (UI-only polish):
 * - Workout Type step removed
 * - Dynamic total step count used for header
 * - Consistent sticky bottom CTA bar with safe-area padding
 * - Tiny "Saved" pill auto-hides after 1.5s
 * - Global CTA hidden on the final step (uses StepFinishTrial's local CTA)
 */
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
    // workout_type remains in the profile so previously saved values still load,
    // but there is no longer a step to edit it during onboarding.
    workout_type: null,
    subscription_status: null,
    trial_end: null,
  });

  const setProfile = (updater: (p: UsersDoc) => UsersDoc) => {
    setProfileState((prev) => updater(prev));
  };

  const swrKey = email ? `/api/profile?email=${encodeURIComponent(email)}` : null;
  const { data, error } = useSWR(swrKey, fetcher);

  // Compute targets on demand (UI-only; data flow unchanged)
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
    else if (goal === "gain") tdee *= 1.1;

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

  // Total steps: Metrics (0), Job+Goal (1), Finish Trial (2)
  const totalSteps = 3;
  const isFirstStep = step <= 0;
  const isLastStep = step >= totalSteps - 1;

  // Removed: availableHeight since Workout Type step is gone
  // const availableHeight = useAvailableHeight("onb-header", "onb-page-nav");

  /* ---- Prefill (refresh-safe) ---- */
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
          // workout_type is still read if present, but not edited in this flow
          workout_type: j?.workout_type ?? prev.workout_type ?? null,
          subscription_status: j?.subscription_status ?? prev.subscription_status ?? null,
          trial_end: j?.trial_end ?? prev.trial_end ?? null,
        }));

        // mark started (non-null writes handled by API)
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

  /* ---- Auto-hide 'Saved' pill after 1.5s ---- */
  useEffect(() => {
    if (savedMsg && savedMsg.toLowerCase().includes("saved")) {
      const t = setTimeout(() => setSavedMsg(null), 1500);
      return () => clearTimeout(t);
    }
  }, [savedMsg]);

  async function autoSave(nextStep?: number) {
    if (!email) return signIn("google");
    setSaving(true);

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
          activity_factor: profile.activity_factor ?? 1.2,
          calorie_target: targets.calorie_target,
          protein_target: targets.protein_target,
          carb_target: targets.carb_target,
          fat_target: targets.fat_target,
          goal_primary: profile.goal_primary ?? null,
          // workout_type included if already present; not edited in this flow
          workout_type: profile.workout_type ?? null,
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
      }));
      setUnsaved(false);
      setSavedMsg("Saved ✅");

      if (swrKey) await mutate(swrKey, undefined, { revalidate: true });
      if (typeof nextStep === "number") setStep(Math.max(0, Math.min(totalSteps - 1, nextStep)));
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
      {/* Header */}
      <header id="onb-header" className="container py-2" style={{ color: "#fff" }}>
        <div className="d-flex align-items-center justify-content-between">
          <h2 className="mb-0" style={{ fontWeight: 700 }}>Let’s Tailor BXKR To You</h2>
          <div className="text-dim">Step {step + 1} / {totalSteps}</div>
        </div>

        <div className="mt-2" aria-live="polite">
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

      {/* Content */}
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

        {/* Sticky Navigation (hidden on final step so no global Save button) */}
        {!isLastStep && (
          <div
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
            className="d-flex justify-content-between"
          >
            <button
              className="btn btn-bxkr-outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={isFirstStep || saving}
              style={{ borderRadius: 24 }}
              aria-label="Back"
            >
              ← Back
            </button>
            <button
              className="btn btn-bxkr"
              onClick={() => autoSave(step + 1)}
              disabled={saving}
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, borderRadius: 24 }}
              aria-label="Next"
            >
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
