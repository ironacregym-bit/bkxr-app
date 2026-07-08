// pages/onboarding.tsx
"use client";

import Head from "next/head";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import BottomNav from "../components/BottomNav";

import OnboardingHeader from "../components/onboarding/OnboardingHeader";
import MetricsStep from "../components/onboarding/MetricsStep";
import GoalStep from "../components/onboarding/GoalStep";
import ProgrammeAccessStep from "../components/onboarding/ProgrammeAccessStep";
import ParqBillingStep from "../components/onboarding/ParqBillingStep";
import FinishStep from "../components/onboarding/FinishStep";
import OnboardingActions from "../components/onboarding/OnboardingActions";

import type {
  GymOption,
  ProgramOption,
  StepKey,
  UsersDoc,
} from "../components/onboarding/onboardingTypes";

import {
  ONBOARDING_FIELD_KEYS,
  STEPS,
  calculateAge,
  calculateTargets,
  getJobTypeFromActivityFactor,
  isValidDob,
  stepIndex,
} from "../components/onboarding/onboardingUtils";

const fetcher = (u: string) =>
  fetch(u).then((r) => {
    if (!r.ok) throw new Error(`Failed ${r.status}`);
    return r.json();
  });

type ProgramsResponse = { items?: ProgramOption[] };
type GymsResponse = { gyms?: GymOption[] };

type MemberStatusResponse = {
  ok?: boolean;
  parq?: {
    completed?: boolean;
    status?: "completed" | "not_started";
    completed_at?: string | null;
    response_id?: string | null;
    requires_medical_review?: boolean;
  };
  required_actions?: Array<{
    key: string;
    title: string;
    message: string;
    href: string;
  }>;
};

function LoadingState() {
  return (
    <main className="container py-3" style={{ paddingBottom: 90, color: "#fff" }}>
      <section className="ia-tile ia-tile-pad">
        <div className="ia-page-title">Loading onboarding…</div>
        <div className="text-dim small mt-1">Pulling in your profile and setup.</div>
      </section>
    </main>
  );
}

function createInitialProfile(email?: string): UsersDoc {
  return {
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
    goal_intensity: null,

    workout_type: null,
    program_id: null,
    program_name: null,
    program_start_mode: "next_monday",

    user_type: null,
    membership_status: null,

    gym_id: null,
    gym_name: null,

    billing_plan: null,
    payment_method_type: null,

    direct_debit_status: null,
    direct_debit_provider: null,
    direct_debit_setup_url: null,

    subscription_status: null,
    trial_end: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,

    parq_status: null,
    parq_completed_at: null,

    location: null,
    role: null,

    onboarding_complete: null,
    onboarding_started_at: null,
    onboarding_completed_at: null,
  };
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
  const [dirtyFields, setDirtyFields] = useState<Set<keyof UsersDoc>>(new Set());

  const email = String(session?.user?.email || "").trim().toLowerCase();

  const returnTo = useMemo(() => {
    const q = router.query.returnTo;
    if (typeof q === "string" && q.trim()) return q;
    return "/";
  }, [router.query.returnTo]);

  const [profile, setProfileState] = useState<UsersDoc>(() => createInitialProfile(email));

  useEffect(() => {
    setMounted(true);
  }, []);

  const profileKey = mounted && email ? `/api/profile?email=${encodeURIComponent(email)}` : null;
  const programsKey = mounted && email ? "/api/programs/list" : null;
  const gymsKey = mounted && email ? "/api/gyms/list" : null;
  const memberStatusKey = mounted && email ? "/api/member/status" : null;

  const { data, error } = useSWR<UsersDoc>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const { data: programsData, isLoading: programsLoading } = useSWR<ProgramsResponse>(
    programsKey,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const { data: gymsData, isLoading: gymsLoading } = useSWR<GymsResponse>(gymsKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const { data: memberStatus, mutate: mutateMemberStatus } = useSWR<MemberStatusResponse>(
    memberStatusKey,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const programs = useMemo(
    () => (Array.isArray(programsData?.items) ? programsData.items : []),
    [programsData]
  );

  const gyms = useMemo(
    () => (Array.isArray(gymsData?.gyms) ? gymsData.gyms : []),
    [gymsData]
  );

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
        getJobTypeFromActivityFactor(Number(data?.activity_factor ?? 1.2)),

      user_type: data?.user_type ?? prev.user_type ?? null,
      membership_status: data?.membership_status ?? prev.membership_status ?? null,

      program_id: data?.program_id ?? prev.program_id ?? null,
      program_name: data?.program_name ?? prev.program_name ?? null,
      program_start_mode: data?.program_start_mode ?? prev.program_start_mode ?? "next_monday",

      gym_id: data?.gym_id ?? prev.gym_id ?? null,
      gym_name: data?.gym_name ?? prev.gym_name ?? null,

      billing_plan: data?.billing_plan ?? prev.billing_plan ?? null,
      payment_method_type: data?.payment_method_type ?? prev.payment_method_type ?? null,

      direct_debit_status: data?.direct_debit_status ?? prev.direct_debit_status ?? null,
      direct_debit_provider: data?.direct_debit_provider ?? prev.direct_debit_provider ?? null,
      direct_debit_setup_url:
        data?.direct_debit_setup_url ?? prev.direct_debit_setup_url ?? null,

      parq_status: data?.parq_status ?? prev.parq_status ?? "not_started",
      parq_completed_at: data?.parq_completed_at ?? prev.parq_completed_at ?? null,
    }));

    setDirty(false);
    setDirtyFields(new Set());
  }, [data, email]);

  useEffect(() => {
    if (!memberStatus?.parq) return;

    const parqCompleted = memberStatus.parq.completed === true;

    setProfileState((prev) => ({
      ...prev,
      parq_status: parqCompleted ? "completed" : prev.parq_status ?? "not_started",
      parq_completed_at: parqCompleted
        ? memberStatus.parq?.completed_at || prev.parq_completed_at || null
        : prev.parq_completed_at ?? null,
    }));
  }, [memberStatus]);

  useEffect(() => {
    if (!email) return;
    if (profile.onboarding_started_at) return;

    const startedAt = new Date().toISOString();

    setProfileState((prev) => ({
      ...prev,
      onboarding_started_at: startedAt,
    }));

    fetch("/api/onboarding/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        onboarding_started_at: startedAt,
      }),
    }).catch(() => null);
  }, [email, profile.onboarding_started_at]);

  useEffect(() => {
    if (!savedMsg) return;

    const t = window.setTimeout(() => setSavedMsg(null), 1600);
    return () => window.clearTimeout(t);
  }, [savedMsg]);

  const age = useMemo(() => calculateAge(profile.DOB || null), [profile.DOB]);
  const targets = useMemo(() => calculateTargets(profile, age), [profile, age]);

  const canShowTargets =
    Number(profile.height_cm ?? 0) > 0 &&
    Number(profile.weight_kg ?? 0) > 0 &&
    !!profile.goal_primary &&
    Number(profile.activity_factor ?? 0) > 0;

  const currentStepMeta = STEPS[stepIndex(step)] || STEPS[0];
  const isFirstStep = step === "metrics";
  const isLastStep = step === "finish";

  const setProfile = (updater: (prev: UsersDoc) => UsersDoc) => {
    setProfileState((prev) => {
      const next = updater(prev);
      const changedKeys = ONBOARDING_FIELD_KEYS.filter((key) => !Object.is(prev[key], next[key]));

      if (changedKeys.length) {
        setDirtyFields((old) => {
          const updated = new Set(old);
          changedKeys.forEach((key) => updated.add(key));
          return updated;
        });

        setDirty(true);
        setSavedMsg(null);
        setErrorMsg(null);
      }

      return next;
    });
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

    if (targetStep === "programme_access") {
      if (!profile.program_id) return "Please choose a training programme.";
      if (!profile.program_start_mode) return "Please choose when the programme should start.";

      if (!profile.user_type) {
        return "Please choose whether you are joining the gym or training online.";
      }

      if (profile.user_type === "gym" && !profile.gym_id) return "Please choose a gym.";
    }

    if (targetStep === "parq_billing") {
      if (!profile.billing_plan) return "Please choose a billing option.";
      if (!profile.payment_method_type) return "Please choose a payment method.";
    }

    return null;
  }

  function buildSafeOnboardingPayload(complete?: boolean) {
    const payload: Record<string, unknown> = {
      email,
    };

    const isCompleting = complete === true;

    const addField = (key: keyof UsersDoc, value: unknown) => {
      if (value === undefined) return;

      if (isCompleting || dirtyFields.has(key)) {
        payload[key] = value;
      }
    };

    addField("sex", profile.sex ?? null);
    addField("DOB", profile.DOB ?? null);
    addField("height_cm", profile.height_cm != null ? Number(profile.height_cm) : null);
    addField("weight_kg", profile.weight_kg != null ? Number(profile.weight_kg) : null);
    addField("bodyfat_pct", profile.bodyfat_pct != null ? Number(profile.bodyfat_pct) : null);

    addField("job_type", profile.job_type ?? null);
    addField(
      "activity_factor",
      profile.activity_factor != null ? Number(profile.activity_factor) : null
    );
    addField("goal_primary", profile.goal_primary ?? null);

    addField("program_id", profile.program_id ?? null);
    addField("program_name", profile.program_name ?? null);
    addField("program_start_mode", profile.program_start_mode || "next_monday");
    addField("workout_type", profile.workout_type ?? null);

    addField("user_type", profile.user_type ?? null);
    addField("membership_status", profile.membership_status ?? null);
    addField("gym_id", profile.gym_id ?? null);
    addField("gym_name", profile.gym_name ?? null);

    addField("billing_plan", profile.billing_plan ?? null);
    addField("payment_method_type", profile.payment_method_type ?? null);
    addField("direct_debit_status", profile.direct_debit_status ?? null);
    addField("direct_debit_provider", profile.direct_debit_provider ?? null);
    addField("direct_debit_setup_url", profile.direct_debit_setup_url ?? null);

    const shouldWriteTargets =
      isCompleting ||
      dirtyFields.has("sex") ||
      dirtyFields.has("DOB") ||
      dirtyFields.has("height_cm") ||
      dirtyFields.has("weight_kg") ||
      dirtyFields.has("bodyfat_pct") ||
      dirtyFields.has("job_type") ||
      dirtyFields.has("activity_factor") ||
      dirtyFields.has("goal_primary");

    if (shouldWriteTargets && targets.caloric_target != null) {
      payload.caloric_target = targets.caloric_target;
      payload.calorie_target = targets.caloric_target;
    }

    if (shouldWriteTargets && targets.protein_target != null) {
      payload.protein_target = targets.protein_target;
    }

    if (shouldWriteTargets && targets.carb_target != null) {
      payload.carb_target = targets.carb_target;
    }

    if (shouldWriteTargets && targets.fat_target != null) {
      payload.fat_target = targets.fat_target;
    }

    if (isCompleting) {
      payload.onboarding_complete = true;
      payload.onboarding_completed_at = new Date().toISOString();
    }

    return payload;
  }

  async function saveProfile(nextStep?: StepKey, complete?: boolean) {
    if (!email) {
      signIn("google", {
        callbackUrl: "/onboarding",
      });
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const payload = buildSafeOnboardingPayload(complete);

      const res = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to save onboarding"));
      }

      setProfileState((prev) => ({
        ...prev,
        ...payload,
        caloric_target: targets.caloric_target ?? prev.caloric_target,
        calorie_target: targets.caloric_target ?? prev.calorie_target,
        protein_target: targets.protein_target ?? prev.protein_target,
        carb_target: targets.carb_target ?? prev.carb_target,
        fat_target: targets.fat_target ?? prev.fat_target,
        onboarding_complete: complete === true ? true : prev.onboarding_complete,
        onboarding_completed_at:
          complete === true
            ? String(payload.onboarding_completed_at || prev.onboarding_completed_at || "")
            : prev.onboarding_completed_at,
      }));

      setDirty(false);
      setDirtyFields(new Set());
      setSavedMsg("Saved ✅");

      if (profileKey) {
        await mutate(profileKey, undefined, {
          revalidate: true,
        });
      }

      if (memberStatusKey) {
        await mutateMemberStatus(undefined, {
          revalidate: true,
        });
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

  function nextStepFor(current: StepKey): StepKey | null {
    if (current === "metrics") return "goal";
    if (current === "goal") return "programme_access";
    if (current === "programme_access") return "parq_billing";
    if (current === "parq_billing") return "finish";
    return null;
  }

  function previousStepFor(current: StepKey): StepKey | null {
    if (current === "goal") return "metrics";
    if (current === "programme_access") return "goal";
    if (current === "parq_billing") return "programme_access";
    if (current === "finish") return "parq_billing";
    return null;
  }

  function handleNext() {
    const validationError = validateStep(step);

    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    const next = nextStepFor(step);
    if (!next) return;

    saveProfile(next);
  }

  function handleBack() {
    setErrorMsg(null);

    const previous = previousStepFor(step);
    if (!previous) return;

    setStep(previous);
  }

  if (!mounted || status === "loading") {
    return (
      <>
        <Head>
          <title>Complete your setup</title>
        </Head>
        <LoadingState />
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
              <button
                className="ia-btn ia-btn-primary"
                onClick={() =>
                  signIn("google", {
                    callbackUrl: "/onboarding",
                  })
                }
              >
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

      <OnboardingHeader step={step} dirty={dirty} savedMsg={savedMsg} />

      <main className="container py-2" style={{ color: "#fff", paddingBottom: 100 }}>
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-card-title-compact">{currentStepMeta.title}</div>
          <div className="text-dim small mt-1">{currentStepMeta.subtitle}</div>
        </section>

        {step === "metrics" ? <MetricsStep profile={profile} setProfile={setProfile} /> : null}

        {step === "goal" ? <GoalStep profile={profile} setProfile={setProfile} /> : null}

        {step === "programme_access" ? (
          <ProgrammeAccessStep
            profile={profile}
            programs={programs}
            gyms={gyms}
            programsLoading={programsLoading}
            gymsLoading={gymsLoading}
            setProfile={setProfile}
          />
        ) : null}

        {step === "parq_billing" ? (
          <ParqBillingStep profile={profile} setProfile={setProfile} />
        ) : null}

        {step === "finish" ? (
          <FinishStep
            profile={profile}
            targets={targets}
            age={age}
            canShowTargets={canShowTargets}
          />
        ) : null}

        {errorMsg ? (
          <section className="ia-tile ia-tile-pad mb-3">
            <div className="ia-inline-note-error">{errorMsg}</div>
          </section>
        ) : null}

        <OnboardingActions
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          saving={saving}
          onBack={handleBack}
          onNext={handleNext}
          onFinish={() => saveProfile(undefined, true)}
        />

        <style jsx global>{`
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
