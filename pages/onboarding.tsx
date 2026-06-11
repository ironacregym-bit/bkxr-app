// pages/onboarding.tsx
"use client";

import Head from "next/head";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Sex = "male" | "female" | "other" | null;
type GoalPrimary = "lose" | "tone" | "gain" | null;
type JobType = "desk" | "mixed" | "manual" | "athlete" | null;
type StepKey = "metrics" | "goal" | "finish";

type UsersDoc = {
  email?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  bodyfat_pct?: number | null;
  DOB?: string | null;
  sex?: Sex;
  job_type?: JobType;
  activity_factor?: number | null;
  caloric_target?: number | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  carb_target?: number | null;
  fat_target?: number | null;
  goal_primary?: GoalPrimary;
  workout_type?: string | null;
  subscription_status?: string | null;
  trial_end?: string | null;
  gym_id?: string | null;
  location?: string | null;
  role?: string | null;
  onboarding_complete?: boolean | null;
  onboarding_started_at?: string | null;
  onboarding_completed_at?: string | null;
};

const STEPS: Array<{ key: StepKey; title: string; subtitle: string }> = [
  {
    key: "metrics",
    title: "Your metrics",
    subtitle: "We use these to personalise your calories and macros.",
  },
  {
    key: "goal",
    title: "Goal and activity",
    subtitle: "Tell us what you want to achieve and how active you are day to day.",
  },
  {
    key: "finish",
    title: "Review and finish",
    subtitle: "Check your setup, save it and continue into Iron Acre.",
  },
];

const ACTIVITY_OPTIONS: Array<{
  job_type: JobType;
  factor: number;
  title: string;
  subtitle: string;
}> = [
  {
    job_type: "desk",
    factor: 1.2,
    title: "Low activity",
    subtitle: "Mostly desk-based, low movement through the day.",
  },
  {
    job_type: "mixed",
    factor: 1.375,
    title: "Light activity",
    subtitle: "A mix of desk work and general movement.",
  },
  {
    job_type: "manual",
    factor: 1.55,
    title: "Moderate activity",
    subtitle: "On your feet often, manual work or physically active job.",
  },
  {
    job_type: "athlete",
    factor: 1.9,
    title: "High activity",
    subtitle: "Very active daily routine, physical work and/or lots of training.",
  },
];

function stepIndex(key: StepKey) {
  return STEPS.findIndex((s) => s.key === key);
}

function isValidDob(value: string | null | undefined) {
  const v = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;

  const d = new Date(`${v}T00:00:00`);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  if (d > now) return false;
  return true;
}

function calculateAge(dob: string | null | undefined) {
  const v = String(dob || "").trim();
  if (!isValidDob(v)) return 30;

  const birth = new Date(`${v}T00:00:00`);
  const now = new Date();

  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return String(Math.round(value));
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<StepKey>("metrics");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const email = String(session?.user?.email || "").trim().toLowerCase();
  const returnTo =
    typeof router.query.returnTo === "string" && router.query.returnTo.trim()
      ? router.query.returnTo
      : "/iron-acre";

  const [profile, setProfileState] = useState<UsersDoc>({
    email: email || undefined,
    height_cm: null,
    weight_kg: null,
    bodyfat_pct: null,
    DOB: null,
    sex: null,
    job_type: null,
    activity_factor: 1.2,
    caloric_target: null,
    calorie_target: null,
    protein_target: null,
    carb_target: null,
    fat_target: null,
    goal_primary: null,
    workout_type: null,
    subscription_status: null,
    trial_end: null,
    gym_id: null,
    location: null,
    role: null,
    onboarding_complete: null,
    onboarding_started_at: null,
    onboarding_completed_at: null,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const profileKey = mounted && email ? `/api/profile?email=${encodeURIComponent(email)}` : null;
  const { data, error } = useSWR<UsersDoc>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  useEffect(() => {
    if (!email || !data) return;

    setProfileState((prev) => ({
      ...prev,
      ...data,
      email,
      activity_factor: Number(data?.activity_factor ?? prev.activity_factor ?? 1.2),
      job_type:
        data?.job_type ??
        prev.job_type ??
        (() => {
          const af = Number(data?.activity_factor ?? 1.2);
          if (Math.abs(af - 1.2) < 0.01) return "desk";
          if (Math.abs(af - 1.375) < 0.01) return "mixed";
          if (Math.abs(af - 1.55) < 0.01) return "manual";
          if (Math.abs(af - 1.9) < 0.01) return "athlete";
          return null;
        })(),
    }));
  }, [data, email]);

  useEffect(() => {
    if (!email) return;
    if (profile.onboarding_started_at) return;

    fetch("/api/onboarding/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        onboarding_started_at: new Date().toISOString(),
      }),
    }).catch(() => null);
  }, [email, profile.onboarding_started_at]);

  useEffect(() => {
    if (!savedMsg) return;

    const t = window.setTimeout(() => setSavedMsg(null), 1600);
    return () => window.clearTimeout(t);
  }, [savedMsg]);

  const age = useMemo(() => calculateAge(profile.DOB || null), [profile.DOB]);

  const targets = useMemo(() => {
    const weight = Number(profile.weight_kg ?? 0);
    const height = Number(profile.height_cm ?? 0);
    const bodyFat = Number(profile.bodyfat_pct ?? 0);
    const af = Number(profile.activity_factor ?? 1.2);
    const sex = profile.sex ?? "other";
    const goal = profile.goal_primary;

    if (!(weight > 0 && height > 0 && af > 0) || !goal) {
      return {
        caloric_target: null,
        protein_target: null,
        carb_target: null,
        fat_target: null,
      };
    }

    const leanMass = bodyFat > 0 && bodyFat < 70 ? weight * (1 - bodyFat / 100) : null;

    const bmr =
      sex === "male"
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : sex === "female"
        ? 10 * weight + 6.25 * height - 5 * age - 161
        : 10 * weight + 6.25 * height - 5 * age;

    let tdee = bmr * af;

    if (goal === "lose") {
      tdee *= 0.85;
    } else if (goal === "tone") {
      tdee *= 1.0;
    } else if (goal === "gain") {
      tdee *= 1.1;
    }

    const proteinBase = leanMass && leanMass > 0 ? leanMass : weight;
    const proteinMultiplier = goal === "lose" ? 2.1 : goal === "gain" ? 1.9 : 1.8;

    const proteinG = Math.max(90, Math.round(proteinBase * proteinMultiplier));
    const fatG = Math.round(Math.min(120, Math.max(45, 0.8 * weight)));
    const kcalAfterProteinAndFat = tdee - (proteinG * 4 + fatG * 9);
    const carbsG = Math.max(0, Math.round(kcalAfterProteinAndFat / 4));

    return {
      caloric_target: Math.round(tdee),
      protein_target: proteinG,
      carb_target: carbsG,
      fat_target: fatG,
    };
  }, [
    profile.weight_kg,
    profile.height_cm,
    profile.bodyfat_pct,
    profile.activity_factor,
    profile.sex,
    profile.goal_primary,
    age,
  ]);

  const canShowTargets =
    Number(profile.height_cm ?? 0) > 0 &&
    Number(profile.weight_kg ?? 0) > 0 &&
    !!profile.goal_primary &&
    Number(profile.activity_factor ?? 0) > 0;

  const currentStepMeta = STEPS[stepIndex(step)];
  const progressPct = ((stepIndex(step) + 1) / STEPS.length) * 100;
  const isFirstStep = step === "metrics";
  const isLastStep = step === "finish";

  const setProfile = (updater: (prev: UsersDoc) => UsersDoc) => {
    setProfileState((prev) => updater(prev));
    setDirty(true);
    setSavedMsg(null);
    setErrorMsg(null);
  };

  function validateStep(targetStep: StepKey) {
    if (targetStep === "metrics") {
      if (!profile.sex) return "Please select sex.";
      if (!profile.DOB || !isValidDob(profile.DOB)) return "Please enter a valid date of birth.";
      if (!(Number(profile.height_cm ?? 0) > 0)) return "Please enter height in cm.";
      if (!(Number(profile.weight_kg ?? 0) > 0)) return "Please enter weight in kg.";
    }

    if (targetStep === "goal") {
      if (!profile.goal_primary) return "Please choose a primary goal.";
      if (!profile.job_type) return "Please choose an activity level.";
      if (!(Number(profile.activity_factor ?? 0) > 0)) return "Activity factor is required.";
    }

    return null;
  }

  async function saveProfile(nextStep?: StepKey, complete?: boolean) {
    if (!email) {
      signIn("google");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const completedAt = complete === true ? new Date().toISOString() : undefined;

      const res = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          sex: profile.sex ?? null,
          DOB: profile.DOB ?? null,
          height_cm: profile.height_cm ?? null,
          weight_kg: profile.weight_kg ?? null,
          bodyfat_pct: profile.bodyfat_pct ?? null,
          job_type: profile.job_type ?? null,
          activity_factor: profile.activity_factor ?? 1.2,
          goal_primary: profile.goal_primary ?? null,
          caloric_target: targets.caloric_target,
          calorie_target: targets.caloric_target,
          protein_target: targets.protein_target,
          carb_target: targets.carb_target,
          fat_target: targets.fat_target,
          gym_id: profile.gym_id ?? null,
          location: profile.location ?? null,
          role: profile.role ?? null,
          onboarding_complete: complete === true ? true : undefined,
          onboarding_completed_at: completedAt,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to save onboarding"));
      }

      setProfileState((prev) => ({
        ...prev,
        caloric_target: targets.caloric_target,
        calorie_target: targets.caloric_target,
        protein_target: targets.protein_target,
        carb_target: targets.carb_target,
        fat_target: targets.fat_target,
        onboarding_complete: complete === true ? true : prev.onboarding_complete,
        onboarding_completed_at:
          complete === true ? completedAt || prev.onboarding_completed_at : prev.onboarding_completed_at,
      }));

      setDirty(false);
      setSavedMsg("Saved ✅");

      if (profileKey) {
        await mutate(profileKey, undefined, { revalidate: true });
      }

      if (nextStep) {
        setStep(nextStep);
      }

      if (complete === true) {
        window.location.href = returnTo;
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save onboarding");
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    const validationError = validateStep(step);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    if (step === "metrics") {
      saveProfile("goal");
      return;
    }

    if (step === "goal") {
      saveProfile("finish");
    }
  }

  function handleBack() {
    setErrorMsg(null);

    if (step === "goal") {
      setStep("metrics");
      return;
    }

    if (step === "finish") {
      setStep("goal");
    }
  }

  if (!mounted || status === "loading") {
    return (
      <>
        <Head>
          <title>Complete your setup</title>
        </Head>
        <main className="container py-3" style={{ paddingBottom: 90, color: "#fff" }}>
          <HomeLoadingScreen />
        </main>
        <BottomNav />
      </>
    );
  }

  if (!email) {
    return (
      <>
        <Head>
          <title>Complete your setup</title>
        </Head>

        <main className="container py-3" style={{ paddingBottom: 90, color: "#fff" }}>
          <section className="ia-tile ia-tile-pad">
            <div className="ia-page-title">Complete your setup</div>
            <div className="text-dim small mt-2">
              Please sign in to continue setting up your profile.
            </div>

            <div className="mt-3">
              <button className="ia-btn ia-btn-primary" onClick={() => signIn("google")}>
                Sign in with Google
              </button>
            </div>
          </section>
        </main>

        <BottomNav />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Complete your setup</title>
        </Head>

        <main className="container py-3" style={{ paddingBottom: 90, color: "#fff" }}>
          <section className="ia-tile ia-tile-pad">
            <div className="ia-page-title">Failed to load your profile</div>
            <div className="text-dim small mt-2">Please refresh the page and try again.</div>
          </section>
        </main>

        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Complete your setup</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <header className="container py-2" style={{ color: "#fff" }}>
        <section className="ia-tile ia-tile-pad">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div style={{ minWidth: 0 }}>
              <div className="ia-kicker">
                <i className="fas fa-sliders-h" />
                onboarding
              </div>
              <div className="ia-page-title">Let’s tailor Iron Acre to you</div>
              <div className="ia-page-subtitle">
                Step {stepIndex(step) + 1} of {STEPS.length}. Complete your profile so we can set better calories and macros.
              </div>
            </div>

            <div className="d-flex flex-column align-items-end gap-2">
              {dirty ? <span className="ia-badge">Unsaved</span> : null}
              {!dirty && savedMsg ? <span className="ia-inline-note-success">{savedMsg}</span> : null}
            </div>
          </div>

          <div
            className="mt-3"
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
      </header>

      <main className="container py-2" style={{ color: "#fff", paddingBottom: 100 }}>
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-card-title-compact">{currentStepMeta.title}</div>
          <div className="text-dim small mt-1">{currentStepMeta.subtitle}</div>
        </section>

        {step === "metrics" ? (
          <section className="ia-tile ia-tile-pad mb-3">
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label ia-label">Sex</label>
                <div className="row g-2">
                  {[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other / prefer not to say" },
                  ].map((opt) => {
                    const selected = profile.sex === opt.value;

                    return (
                      <div key={opt.value} className="col-12 col-md-4">
                        <button
                          type="button"
                          className={selected ? "ia-btn ia-btn-primary w-100" : "ia-btn ia-btn-outline w-100"}
                          onClick={() =>
                            setProfile((prev) => ({
                              ...prev,
                              sex: opt.value as Sex,
                            }))
                          }
                        >
                          {opt.label}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label ia-label">Date of birth</label>
                <input
                  type="date"
                  className="form-control ia-form-input"
                  value={profile.DOB || ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      DOB: e.target.value || null,
                    }))
                  }
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label ia-label">Height (cm)</label>
                <input
                  type="number"
                  min="100"
                  max="250"
                  step="1"
                  className="form-control ia-form-input"
                  value={profile.height_cm ?? ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      height_cm: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label ia-label">Weight (kg)</label>
                <input
                  type="number"
                  min="25"
                  max="300"
                  step="0.1"
                  className="form-control ia-form-input"
                  value={profile.weight_kg ?? ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      weight_kg: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label ia-label">Body fat % (optional)</label>
                <input
                  type="number"
                  min="1"
                  max="70"
                  step="0.1"
                  className="form-control ia-form-input"
                  value={profile.bodyfat_pct ?? ""}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      bodyfat_pct: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                />
              </div>
            </div>
          </section>
        ) : null}

        {step === "goal" ? (
          <>
            <section className="ia-tile ia-tile-pad mb-3">
              <div className="mb-3">
                <div className="ia-card-title-compact">What’s your main goal?</div>
                <div className="text-dim small mt-1">
                  We’ll use this to set your calorie and macro targets.
                </div>
              </div>

              <div className="d-grid gap-2">
                {[
                  {
                    value: "lose",
                    title: "Lose weight",
                    subtitle: "Create a manageable calorie deficit while keeping protein high.",
                  },
                  {
                    value: "tone",
                    title: "Maintain / tone",
                    subtitle: "Support body composition and recovery without pushing calories aggressively.",
                  },
                  {
                    value: "gain",
                    title: "Gain muscle",
                    subtitle: "Support training performance and lean muscle gain with extra energy.",
                  },
                ].map((opt) => {
                  const selected = profile.goal_primary === opt.value;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={selected ? "ia-onb-choice ia-onb-choice-selected" : "ia-onb-choice"}
                      onClick={() =>
                        setProfile((prev) => ({
                          ...prev,
                          goal_primary: opt.value as GoalPrimary,
                        }))
                      }
                    >
                      <span className="ia-onb-choice-title">{opt.title}</span>
                      <span className="ia-onb-choice-subtitle">{opt.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="ia-tile ia-tile-pad mb-3">
              <div className="mb-3">
                <div className="ia-card-title-compact">How active are you outside training?</div>
                <div className="text-dim small mt-1">
                  This helps estimate daily energy needs more accurately.
                </div>
              </div>

              <div className="d-grid gap-2">
                {ACTIVITY_OPTIONS.map((opt) => {
                  const selected = profile.job_type === opt.job_type;

                  return (
                    <button
                      key={opt.job_type}
                      type="button"
                      className={selected ? "ia-onb-choice ia-onb-choice-selected" : "ia-onb-choice"}
                      onClick={() =>
                        setProfile((prev) => ({
                          ...prev,
                          job_type: opt.job_type,
                          activity_factor: opt.factor,
                        }))
                      }
                    >
                      <span className="ia-onb-choice-title">{opt.title}</span>
                      <span className="ia-onb-choice-subtitle">{opt.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}

        {step === "finish" ? (
          <section className="ia-tile ia-tile-pad mb-3">
            <div className="ia-kicker">
              <i className="fas fa-flag-checkered" />
              finish
            </div>

            <div className="ia-card-title-compact mt-2">Your setup is nearly done</div>
            <div className="text-dim small mt-1">
              Review the details below and save your onboarding to continue into the app.
            </div>

            <div className="row g-2 mt-2">
              <div className="col-12 col-md-6">
                <div className="ia-summary-card">
                  <div className="ia-summary-label">Sex</div>
                  <div className="ia-summary-value">{profile.sex || "—"}</div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-summary-card">
                  <div className="ia-summary-label">Age</div>
                  <div className="ia-summary-value">{profile.DOB ? age : "—"}</div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-summary-card">
                  <div className="ia-summary-label">Height</div>
                  <div className="ia-summary-value">
                    {profile.height_cm ? `${formatNumber(profile.height_cm)} cm` : "—"}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-summary-card">
                  <div className="ia-summary-label">Weight</div>
                  <div className="ia-summary-value">
                    {profile.weight_kg ? `${formatNumber(profile.weight_kg)} kg` : "—"}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-summary-card">
                  <div className="ia-summary-label">Goal</div>
                  <div className="ia-summary-value">
                    {profile.goal_primary === "lose"
                      ? "Lose weight"
                      : profile.goal_primary === "tone"
                      ? "Maintain / tone"
                      : profile.goal_primary === "gain"
                      ? "Gain muscle"
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-summary-card">
                  <div className="ia-summary-label">Activity</div>
                  <div className="ia-summary-value">
                    {ACTIVITY_OPTIONS.find((x) => x.job_type === profile.job_type)?.title || "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="ia-tile ia-tile-pad mt-3">
              <div className="ia-kicker">
                <i className="fas fa-bullseye" />
                nutrition targets
              </div>

              {!canShowTargets ? (
                <div className="text-dim small mt-2">
                  Complete the previous steps to calculate your daily targets.
                </div>
              ) : (
                <div className="row g-2 mt-2">
                  <div className="col-6 col-md-3">
                    <div className="ia-summary-card">
                      <div className="ia-summary-label">Calories</div>
                      <div className="ia-summary-value">{formatNumber(targets.caloric_target)}</div>
                    </div>
                  </div>

                  <div className="col-6 col-md-3">
                    <div className="ia-summary-card">
                      <div className="ia-summary-label">Protein</div>
                      <div className="ia-summary-value">{formatNumber(targets.protein_target)}g</div>
                    </div>
                  </div>

                  <div className="col-6 col-md-3">
                    <div className="ia-summary-card">
                      <div className="ia-summary-label">Carbs</div>
                      <div className="ia-summary-value">{formatNumber(targets.carb_target)}g</div>
                    </div>
                  </div>

                  <div className="col-6 col-md-3">
                    <div className="ia-summary-card">
                      <div className="ia-summary-label">Fats</div>
                      <div className="ia-summary-value">{formatNumber(targets.fat_target)}g</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {errorMsg ? (
          <section className="ia-tile ia-tile-pad mb-3">
            <div className="ia-inline-note-error">{errorMsg}</div>
          </section>
        ) : null}

        <section
          className="ia-tile ia-tile-pad"
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 10,
          }}
        >
          <div className="d-flex justify-content-between gap-2 flex-wrap">
            <button
              type="button"
              className="ia-btn ia-btn-muted"
              onClick={handleBack}
              disabled={isFirstStep || saving}
            >
              Back
            </button>

            {!isLastStep ? (
              <button
                type="button"
                className="ia-btn ia-btn-primary"
                onClick={handleNext}
                disabled={saving}
              >
                {saving ? "Saving..." : "Next"}
              </button>
            ) : (
              <button
                type="button"
                className="ia-btn ia-btn-primary"
                onClick={() => saveProfile(undefined, true)}
                disabled={saving}
              >
                {saving ? "Saving..." : "Finish setup"}
              </button>
            )}
          </div>
        </section>

        <style jsx>{`
          .ia-label {
            color: rgba(255, 255, 255, 0.88);
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
            border-color: rgba(24, 255, 154, 0.42);
            box-shadow: 0 0 0 3px rgba(24, 255, 154, 0.12);
            background: rgba(255, 255, 255, 0.04);
            color: #fff;
          }

          .ia-form-input::placeholder {
            color: rgba(255, 255, 255, 0.38);
          }

          .ia-summary-card {
            border-radius: 14px;
            padding: 12px 14px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            min-height: 78px;
          }

          .ia-summary-label {
            font-size: 0.75rem;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--ia-muted);
            margin-bottom: 6px;
          }

          .ia-summary-value {
            font-size: 1rem;
            font-weight: 700;
            color: #fff;
          }

          .ia-onb-choice {
            width: 100%;
            border: 1px solid rgba(24, 255, 154, 0.18);
            background: rgba(6, 18, 24, 0.88);
            color: #fff;
            border-radius: 18px;
            padding: 14px 16px;
            min-height: 72px;
            text-align: left;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            gap: 4px;
            box-shadow: inset 0 0 0 1px rgba(24, 255, 154, 0.04);
          }

          .ia-onb-choice:hover {
            border-color: rgba(24, 255, 154, 0.28);
            background: rgba(8, 22, 28, 0.94);
          }

          .ia-onb-choice-selected {
            width: 100%;
            border: none;
            border-radius: 18px;
            padding: 14px 16px;
            min-height: 72px;
            text-align: left;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            gap: 4px;
            color: #041311;
            background: linear-gradient(135deg, var(--ia-neon), var(--ia-neon2));
            box-shadow: var(--ia-btn-primary-shadow);
          }

          .ia-onb-choice-title {
            display: block;
            font-weight: 800;
            font-size: 0.98rem;
            line-height: 1.2;
            white-space: normal;
          }

          .ia-onb-choice-subtitle {
            display: block;
            font-size: 0.78rem;
            line-height: 1.35;
            opacity: 0.92;
            white-space: normal;
          }

          @media (max-width: 575.98px) {
            .ia-onb-choice,
            .ia-onb-choice-selected {
              min-height: 78px;
              padding: 13px 14px;
              border-radius: 16px;
            }

            .ia-onb-choice-title {
              font-size: 0.94rem;
            }

            .ia-onb-choice-subtitle {
              font-size: 0.74rem;
              line-height: 1.3;
            }
          }
        `}</style>
      </main>

      <BottomNav />
    </>
  );
}
