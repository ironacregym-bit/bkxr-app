
// pages/onboarding.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

/* -------------------- Types -------------------- */
type WorkoutType = "bodyweight" | "kettlebells" | "dumbbells";
type FightingStyle = "boxing" | "kickboxing";
type JobType = "desk" | "mixed" | "manual" | "athlete";

type UsersDoc = {
  email?: string;
  // metrics
  height_cm?: number | null;
  weight_kg?: number | null;
  bodyfat_pct?: number | null;
  DOB?: string | null;
  sex?: "male" | "female" | "other" | null;
  // activity + targets
  job_type?: JobType | null;
  activity_factor?: number | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  carb_target?: number | null;
  fat_target?: number | null;
  // goals (simplified)
  goal_primary?: "lose" | "tone" | "gain" | null;
  // new workout choices
  workout_type?: WorkoutType | null;
  fighting_style?: FightingStyle | null;
  // legacy equipment for compatibility
  equipment?: { bodyweight?: boolean; kettlebell?: boolean; dumbbell?: boolean } | null;
  // context
  gym_id?: string | null;
  location?: string | null;
  role?: string | null;
  // billing (webhook writes these)
  subscription_status?: "trialing" | "active" | "past_due" | "canceled" | "paused" | "incomplete" | null;
  trial_end?: string | null; // ISO
};

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const email = session?.user?.email || null;

  // Steps:
  // 0 Your Metrics
  // 1 Job Type + Main Goal
  // 2 Workout Type (thirds)
  // 3 Fighting Style (halves)
  // 4 Finish + (optional) Free Trial CTA
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState<boolean>(false);

  const markDirty = () => {
    setUnsaved(true);
    setSavedMsg(null);
  };

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
    equipment: { bodyweight: true, kettlebell: false, dumbbell: false }, // legacy compat
    subscription_status: null,
    trial_end: null,
  });

  const swrKey = email ? `/api/profile?email=${encodeURIComponent(email)}` : null;
  const { data, error } = useSWR(swrKey, fetcher);

  /* ---- Derived values (hooks above any return) ---- */
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

  // Helpers for nav disabled to avoid TS literal narrowing issues inside JSX branches
  const isFirstStep = step <= 0;
  const isLastStep = step >= 4;

  /* ---- Prefill from API, mark onboarding_started_at ---- */
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

  /* -------------------- Helpers -------------------- */
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
    if (goal === "lose") tdee *= 0.85;      // Drop Fat
    else if (goal === "tone") tdee *= 1.0;  // Tone Up
    else if (goal === "gain") tdee *= 1.10; // Put On Muscle

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

    const targets = computeTargets(profile);
    const equipmentPayload = workoutTypeToEquipment(profile.workout_type ?? null);

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
          activity_factor: jobTypeToAF(profile.job_type ?? null),
          // targets
          calorie_target: targets.calorie_target,
          protein_target: targets.protein_target,
          carb_target: targets.carb_target,
          fat_target: targets.fat_target,
          // goals
          goal_primary: profile.goal_primary ?? null,
          // new choices
          workout_type: profile.workout_type ?? null,
          fighting_style: profile.fighting_style ?? null,
          // legacy equipment for compat
          equipment: equipmentPayload,
          // passthrough
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
        {/* Header + trial banner */}
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h2 className="mb-0" style={{ fontWeight: 700 }}>Let’s Tailor BXKR To You</h2>
          <div className="text-dim">Step {step + 1} / 5</div>
        </div>

        {/* Saved / Unsaved indicator */}
        <div className="mb-3">
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

        {profile.trial_end && (
          <div className="futuristic-card p-3 mb-3" style={{ borderLeft: `4px solid ${ACCENT}` }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>Trial</strong>: {trialDaysLeft} days left
                <span className="text-dim ms-2">
                  Ends {new Date(profile.trial_end).toLocaleDateString()}
                </span>
              </div>
              <button className="btn btn-bxkr-outline" onClick={openPortal} disabled={saving}>
                Manage Billing
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 0 — Your Metrics ===== */}
        {step === 0 && (
          <section
            className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-center"
            style={{ minHeight: "65vh" }}
          >
            <h5 className="mb-2">Your Metrics</h5>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label small text-dim">Height (cm)</label>
                <input
                  type="number"
                  className="form-control"
                  value={profile.height_cm ?? ""}
                  onChange={(e) => {
                    markDirty();
                    setProfile({ ...profile, height_cm: Number(e.target.value) || null });
                  }}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small text-dim">Weight (kg)</label>
                <input
                  type="number"
                  className="form-control"
                  value={profile.weight_kg ?? ""}
                  onChange={(e) => {
                    markDirty();
                    setProfile({ ...profile, weight_kg: Number(e.target.value) || null });
                  }}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small text-dim">Date Of Birth</label>
                <input
                  type="date"
                  className="form-control"
                  value={profile.DOB ?? ""}
                  onChange={(e) => {
                    markDirty();
                    setProfile({ ...profile, DOB: e.target.value || null });
                  }}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small text-dim">Gender</label>
                <select
                  className="form-select"
                  value={profile.sex ?? ""}
                  onChange={(e) => {
                    markDirty();
                    setProfile({ ...profile, sex: (e.target.value || null) as UsersDoc["sex"] });
                  }}
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / Prefer Not To Say</option>
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small text-dim">
                  Body Fat (%) <span className="text-dim">(If Known)</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={profile.bodyfat_pct ?? ""}
                  onChange={(e) => {
                    markDirty();
                    setProfile({ ...profile, bodyfat_pct: Number(e.target.value) || null });
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {/* ===== STEP 1 — Job Type + Main Goal ===== */}
        {step === 1 && (
          <section
            className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-center"
            style={{ minHeight: "65vh" }}
          >
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
                    onClick={() => {
                      markDirty();
                      setProfile({
                        ...profile,
                        job_type: opt.key as JobType,
                        activity_factor: opt.af,
                      });
                    }}
                    style={{
                      background: active ? "rgba(255,138,42,0.12)" : undefined,
                      borderColor: active ? ACCENT : undefined,
                      color: active ? "#fff" : undefined,
                    }}
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
                    onClick={() => {
                      markDirty();
                      setProfile({ ...profile, goal_primary: opt.key as UsersDoc["goal_primary"] });
                    }}
                    style={{
                      background: active ? "rgba(255,138,42,0.12)" : undefined,
                      borderColor: active ? ACCENT : undefined,
                      color: active ? "#fff" : undefined,
                    }}
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

        {/* ===== STEP 2 — Workout Type (full‑bleed to viewport edge, fits remaining height) ===== */}
        {step === 2 && (
          <section
            style={{
              display: "grid",
              gridTemplateRows: "auto 1fr auto",
              // iOS safe height
              minHeight: "100svh",
              minHeightFallback: "100vh",
            } as React.CSSProperties}
          >
            {/* Title inside container */}
            <div className="panel-header px-3">
              <h5 className="mb-2">Workout Type</h5>
            </div>

            {/* Full‑bleed image column (edge to edge) */}
            <div
              style={{
                width: "100vw",
                marginLeft: "calc(50% - 50vw)",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                gap: 0,
              }}
            >
              {/* Bodyweight (1/3 of column via flex) */}
              <button
                type="button"
                style={{
                  flex: "1 1 0",
                  minHeight: 0,
                  border: "none",
                  padding: 0,
                  backgroundImage: "url(/bodyweight.jpg)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => {
                  markDirty();
                  setProfile({ ...profile, workout_type: "bodyweight" });
                }}
              >
                {/* Motivator overlay on selection */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "14px 16px",
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
                    color: "#fff",
                    opacity: profile.workout_type === "bodyweight" ? 1 : 0,
                    transition: "opacity .18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>Bodyweight</div>
                    <div className="text-dim">Train anywhere. Own your movement patterns and stability.</div>
                  </div>
                </div>
              </button>

              {/* Kettlebells */}
              <button
                type="button"
                style={{
                  flex: "1 1 0",
                  minHeight: 0,
                  border: "none",
                  padding: 0,
                  backgroundImage: "url(/kettlebells.jpg)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => {
                  markDirty();
                  setProfile({ ...profile, workout_type: "kettlebells" });
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "14px 16px",
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
                    color: "#fff",
                    opacity: profile.workout_type === "kettlebells" ? 1 : 0,
                    transition: "opacity .18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>Kettlebells</div>
                    <div className="text-dim">Explosive strength & conditioning. Flow, hinge and press.</div>
                  </div>
                </div>
              </button>

              {/* Dumbbells */}
              <button
                type="button"
                style={{
                  flex: "1 1 0",
                  minHeight: 0,
                  border: "none",
                  padding: 0,
                  backgroundImage: "url(/dumbbells.jpg)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => {
                  markDirty();
                  setProfile({ ...profile, workout_type: "dumbbells" });
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "14px 16px",
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
                    color: "#fff",
                    opacity: profile.workout_type === "dumbbells" ? 1 : 0,
                    transition: "opacity .18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>Dumbbells</div>
                    <div className="text-dim">Classic resistance, balanced loading, scalable progressions.</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Back / Next in view */}
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <button
                className="btn btn-bxkr-outline"
                onClick={() => autoSave(step - 1)}
                disabled={isFirstStep || saving}
              >
                ← Back
              </button>
              <button className="btn btn-bxkr" onClick={() => autoSave(step + 1)} disabled={saving}>
                Next →
                {saving && <span className="inline-spinner ms-2" />}
              </button>
            </div>
          </section>
        )}

        {/* ===== STEP 3 — Fighting Style (full‑bleed to viewport edge, fits remaining height) ===== */}
        {step === 3 && (
          <section
            style={{
              display: "grid",
              gridTemplateRows: "auto 1fr auto",
              minHeight: "100svh",
            }}
          >
            <div className="panel-header px-3">
              <h5 className="mb-2">Fighting Style</h5>
            </div>

            <div
              style={{
                width: "100vw",
                marginLeft: "calc(50% - 50vw)",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                gap: 0,
              }}
            >
              {/* Boxing (upper half) */}
              <button
                type="button"
                style={{
                  flex: "1 1 0",
                  minHeight: 0,
                  border: "none",
                  padding: 0,
                  backgroundImage: "url(/boxing.jpg)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => {
                  markDirty();
                  setProfile({ ...profile, fighting_style: "boxing" });
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "14px 16px",
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
                    color: "#fff",
                    opacity: profile.fighting_style === "boxing" ? 1 : 0,
                    transition: "opacity .18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>Boxing</div>
                    <div className="text-dim">
                      Purely punch‑based. Master the sweet science of speed & precision.
                    </div>
                  </div>
                </div>
              </button>

              {/* Kickboxing (lower half) */}
              <button
                type="button"
                style={{
                  flex: "1 1 0",
                  minHeight: 0,
                  border: "none",
                  padding: 0,
                  backgroundImage: "url(/kickboxing.jpg)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => {
                  markDirty();
                  setProfile({ ...profile, fighting_style: "kickboxing" });
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "14px 16px",
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
                    color: "#fff",
                    opacity: profile.fighting_style === "kickboxing" ? 1 : 0,
                    transition: "opacity .18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>Kickboxing</div>
                    <div className="text-dim">
                      Punches, kicks & knees. Total‑body power and athletic footwork.
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <button
                className="btn btn-bxkr-outline"
                onClick={() => autoSave(step - 1)}
                disabled={isFirstStep || saving}
              >
                ← Back
              </button>
              <button className="btn btn-bxkr" onClick={() => autoSave(step + 1)} disabled={saving}>
                Next →
                {saving && <span className="inline-spinner ms-2" />}
              </button>
            </div>
          </section>
        )}

        {/* ===== STEP 4 — Finish + Free Trial (no 'Maybe Later') ===== */}
        {step === 4 && (
          <section
            className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-center"
            style={{ minHeight: "65vh" }}
          >
            {profile.subscription_status !== "active" &&
             profile.subscription_status !== "trialing" && (
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
              <button
                className="btn btn-bxkr-outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={isFirstStep || saving}
              >
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

        {/* Default nav for card steps (0 and 1) */}
        {(step === 0 || step === 1) && (
          <div className="d-flex justify-content-between">
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
