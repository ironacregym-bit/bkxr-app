
// pages/onboarding.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

type UsersDoc = {
  email?: string;
  // metrics
  height_cm?: number | null;
  weight_kg?: number | null;
  bodyfat_pct?: number | null;
  DOB?: string | null;
  sex?: "male" | "female" | "other" | null;
  // activity + targets
  activity_factor?: number | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  carb_target?: number | null;
  fat_target?: number | null;
  // goals
  goal_primary?: "lose" | "tone" | "gain" | null;
  goal_intensity?: "small" | "large" | "maint" | "lean" | null;
  // extras
  equipment?: { bodyweight?: boolean; kettlebell?: boolean; dumbbell?: boolean } | null;
  preferences?: { boxing_focus?: boolean; kettlebell_focus?: boolean; schedule_days?: number } | null;
  // context
  gym_id?: string | null;
  location?: string | null;
  role?: string | null;
  // billing (webhook writes these)
  subscription_status?: "trialing" | "active" | "past_due" | "canceled" | "paused" | "incomplete" | null;
  trial_end?: string | null; // ISO
};

type GoalPrimary = "lose" | "tone" | "gain";

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
    activity_factor: 1.2,
    calorie_target: null,
    protein_target: null,
    carb_target: null,
    fat_target: null,
    goal_primary: null,
    goal_intensity: null,
    equipment: { bodyweight: true, kettlebell: false, dumbbell: false },
    preferences: { boxing_focus: true, kettlebell_focus: true, schedule_days: 3 },
    subscription_status: null,
    trial_end: null,
  });

  // SWR key can be null; SWR still calls the hook safely in a consistent order.
  const swrKey = email ? `/api/profile?email=${encodeURIComponent(email)}` : null;
  const { data, error } = useSWR(swrKey, fetcher);

  // --- Hooks must be placed before any conditional returns ---
  // Derived targets visibility (cheap, no hook needed)
  const canShowTargets =
    (profile.height_cm ?? 0) > 0 &&
    (profile.weight_kg ?? 0) > 0 &&
    !!profile.activity_factor &&
    !!profile.goal_primary &&
    !!profile.calorie_target;

  // Derived trial days left (useMemo is fine here because it’s always called)
  const trialDaysLeft = useMemo(() => {
    if (!profile.trial_end) return null;
    const ms = new Date(profile.trial_end).getTime() - Date.now();
    const d = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return d > 0 ? d : 0;
  }, [profile.trial_end]);

  // Load initial user doc: prefill + billing info, mark onboarding_started_at
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
          preferences: {
            boxing_focus: !!j?.preferences?.boxing_focus,
            kettlebell_focus: !!j?.preferences?.kettlebell_focus,
            schedule_days: Number(j?.preferences?.schedule_days ?? 3),
          },
          subscription_status: (j as UsersDoc)?.subscription_status ?? prev.subscription_status ?? null,
          trial_end: (j as UsersDoc)?.trial_end ?? prev.trial_end ?? null,
        }));

        if (j.calorie_target || j.protein_target || j.carb_target || j.fat_target) {
          setSavedMsg("Targets loaded");
        }

        // Mark onboarding started (idempotent)
        await fetch("/api/onboarding/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, onboarding_started_at: new Date().toISOString() }),
        });
      } catch (e: any) {
        // We’ll show the error below in the conditional render
        console.error("[onboarding] load error:", e?.message || e);
      }
    })();
  }, [status, email]);

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
    const intensity = p.goal_intensity;
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

    if (goal === "lose") {
      tdee *= intensity === "large" ? 0.8 : intensity === "small" ? 0.9 : 0.9;
    } else if (goal === "tone") {
      tdee *= 1.0;
    } else if (goal === "gain") {
      tdee *= intensity === "lean" ? 1.10 : 1.10;
    }

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

  async function autoSave(nextStep?: number) {
    if (!email) return signIn("google");
    setSaving(true);
    setSavedMsg(null);

    const targets = computeTargets(profile);

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
          activity_factor: profile.activity_factor ?? 1.2,
          // targets
          calorie_target: targets.calorie_target,
          protein_target: targets.protein_target,
          carb_target: targets.carb_target,
          fat_target: targets.fat_target,
          // goals
          goal_primary: profile.goal_primary ?? null,
          goal_intensity: profile.goal_intensity ?? null,
          // extras
          equipment: profile.equipment ?? null,
          preferences: profile.preferences ?? null,
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
        calorie_target: targets.calorie_target,
        protein_target: targets.protein_target,
        carb_target: targets.carb_target,
        fat_target: targets.fat_target,
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

  // Stripe actions
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

  // --- Conditional returns AFTER all hooks (to keep hook order consistent) ---
  if (!email) {
    return (
      <>
        <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">Welcome to BXKR</h5>
            <p className="text-dim mb-3">Please sign in to personalise your training.</p>
            <button className="btn btn-bxkr" onClick={() => signIn("google")}>
              Sign in with Google
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
          <div className="bxkr-card p-3 mb-3 text-danger">Failed to load your profile.</div>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 className="mb-0" style={{ fontWeight: 700 }}>Let’s tailor BXKR to you</h2>
          <div className="text-dim">Step {step + 1} / 5</div>
        </div>

        {savedMsg && <div className="pill-success mb-3">{savedMsg}</div>}

        {/* Trial banner (from webhook data) */}
        {profile.trial_end && (
          <div className="bxkr-card p-3 mb-3" style={{ borderLeft: `4px solid ${ACCENT}` }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>Trial</strong>: {trialDaysLeft} days left
                <span className="text-dim ms-2">
                  Ends {new Date(profile.trial_end).toLocaleDateString()}
                </span>
              </div>
              <button className="btn btn-bxkr-outline" onClick={openPortal} disabled={saving}>
                Manage billing
              </button>
            </div>
          </div>
        )}

        {/* STEP 0 — Metrics */}
        {step === 0 && (
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">Your metrics</h5>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small text-dim">Height (cm)</label>
                <input
                  type="number"
                  className="form-control"
                  value={profile.height_cm ?? ""}
                  onChange={(e) => setProfile({ ...profile, height_cm: Number(e.target.value) || null })}
                />
              </div>
              <div className="col-6">
                <label className="form-label small text-dim">Weight (kg)</label>
                <input
                  type="number"
                  className="form-control"
                  value={profile.weight_kg ?? ""}
                  onChange={(e) => setProfile({ ...profile, weight_kg: Number(e.target.value) || null })}
                />
              </div>
              <div className="col-6">
                <label className="form-label small text-dim">Date of Birth</label>
                <input
                  type="date"
                  className="form-control"
                  value={profile.DOB ?? ""}
                  onChange={(e) => setProfile({ ...profile, DOB: e.target.value || null })}
                />
              </div>
              <div className="col-6">
                <label className="form-label small text-dim">Gender</label>
                <select
                  className="form-select"
                  value={profile.sex ?? ""}
                  onChange={(e) => setProfile({ ...profile, sex: (e.target.value || null) as UsersDoc["sex"] })}
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / Prefer not to say</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small text-dim">Body fat (%)</label>
                <input
                  type="number"
                  className="form-control"
                  value={profile.bodyfat_pct ?? ""}
                  onChange={(e) => setProfile({ ...profile, bodyfat_pct: Number(e.target.value) || null })}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 1 — Activity & Goal */}
        {step === 1 && (
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">Daily activity &amp; goal</h5>
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label small text-dim">Activity multiplier</label>
                <select
                  className="form-select"
                  value={profile.activity_factor ?? 1.2}
                  onChange={(e) => setProfile({ ...profile, activity_factor: Number(e.target.value) || 1.2 })}
                >
                  <option value={1.2}>Sedentary (mostly desk)</option>
                  <option value={1.375}>Lightly active</option>
                  <option value={1.55}>Moderately active</option>
                  <option value={1.725}>Very active</option>
                  <option value={1.9}>Athlete</option>
                </select>
              </div>

              <div className="col-6">
                <label className="form-label small text-dim">Main goal</label>
                <select
                  className="form-select"
                  value={profile.goal_primary ?? ""}
                  onChange={(e) => setProfile({ ...profile, goal_primary: (e.target.value || null) as GoalPrimary })}
                >
                  <option value="">Select…</option>
                  <option value="lose">Lose weight</option>
                  <option value="tone">Tone up</option>
                  <option value="gain">Gain weight</option>
                </select>
              </div>

              <div className="col-6">
                <label className="form-label small text-dim">Intensity</label>
                <select
                  className="form-select"
                  value={profile.goal_intensity ?? "maint"}
                  onChange={(e) =>
                    setProfile({ ...profile, goal_intensity: (e.target.value || null) as UsersDoc["goal_intensity"] })
                  }
                >
                  {profile.goal_primary === "lose" && (
                    <>
                      <option value="small">Small cut</option>
                      <option value="large">Larger cut</option>
                    </>
                  )}
                  {profile.goal_primary === "tone" && (
                    <>
                      <option value="maint">Maintenance / recomp</option>
                    </>
                  )}
                  {profile.goal_primary === "gain" && (
                    <>
                      <option value="lean">Lean gain</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {canShowTargets && (
              <div className="bxkr-card p-3 mt-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="fw-semibold mb-1">Targets (per day)</div>
                <div className="small">
                  <div>Calories: <strong>{profile.calorie_target ?? "—"}</strong> kcal</div>
                  <div>Protein: <strong>{profile.protein_target ?? "—"}</strong> g</div>
                  <div>Carbs: <strong>{profile.carb_target ?? "—"}</strong> g</div>
                  <div>Fat: <strong>{profile.fat_target ?? "—"}</strong> g</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — Equipment */}
        {step === 2 && (
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">Equipment at home</h5>
            <div className="row g-2">
              <div className="col-4">
                <label className="form-label small text-dim">Bodyweight</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!profile.equipment?.bodyweight}
                  onChange={(e) =>
                    setProfile({ ...profile, equipment: { ...profile.equipment, bodyweight: e.target.checked } })
                  }
                />
              </div>
              <div className="col-4">
                <label className="form-label small text-dim">Kettlebell</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!profile.equipment?.kettlebell}
                  onChange={(e) =>
                    setProfile({ ...profile, equipment: { ...profile.equipment, kettlebell: e.target.checked } })
                  }
                />
              </div>
              <div className="col-4">
                <label className="form-label small text-dim">Dumbbell</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!profile.equipment?.dumbbell}
                  onChange={(e) =>
                    setProfile({ ...profile, equipment: { ...profile.equipment, dumbbell: e.target.checked } })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Preferences */}
        {step === 3 && (
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">Preferences</h5>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small text-dim">Boxing emphasis</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!profile.preferences?.boxing_focus}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      preferences: { ...(profile.preferences || {}), boxing_focus: e.target.checked },
                    })
                  }
                />
              </div>
              <div className="col-6">
                <label className="form-label small text-dim">Kettlebell emphasis</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!profile.preferences?.kettlebell_focus}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      preferences: { ...(profile.preferences || {}), kettlebell_focus: e.target.checked },
                    })
                  }
                />
              </div>
              <div className="col-12 mt-2">
                <label className="form-label small text-dim">Target sessions per week</label>
                <select
                  className="form-select"
                  value={profile.preferences?.schedule_days ?? 3}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      preferences: { ...(profile.preferences || {}), schedule_days: Number(e.target.value) },
                    })
                  }
                >
                  {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 — All set! + Trial CTA if not active */}
        {step === 4 && (
          <>
            {profile.subscription_status !== "active" && (
              <div className="bxkr-card p-3 mb-3">
                <h5 className="mb-2">Start your 14‑day free trial</h5>
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
                    {saving ? "Starting…" : "Start free trial"}
                  </button>
                  <button className="btn btn-bxkr-outline" type="button" disabled={saving}>
                    Maybe later
                  </button>
                </div>
              </div>
            )}

            <div className="bxkr-card p-3 mb-3">
              <h5 className="mb-2">All set!</h5>
              <p className="text-dim">
                BXKR will tailor your workouts and tasks based on your metrics, goals, and equipment.
              </p>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="d-flex justify-content-between">
          <button
            className="btn btn-bxkr-outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
          >
            ← Back
          </button>
          <button
            className="btn btn-bxkr"
            onClick={() => {
              const next = step + 1;
              if (next <= 4) {
                autoSave(next);
              } else {
                autoSave();
                window.location.href = "/";
              }
            }}
            disabled={saving}
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, borderRadius: 24 }}
          >
            {step < 4 ? "Next →" : "Finish → Home"}
            {saving && <span className="inline-spinner ms-2" />}
          </button>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
