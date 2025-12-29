
// pages/onboarding.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const ACCENT = "#FF8A2A";

type UsersDoc = {
  email?: string;
  name?: string;
  image?: string;
  created_at?: string;
  last_login_at?: string;
  calorie_target?: number | null;
  weight_kg?: number | null;
  bodyfat_pct?: number | null;
  DOB?: string | null; // ISO YYYY-MM-DD
  activity_factor?: number | null;
  carb_target?: number | null;
  fat_target?: number | null;
  gym_id?: string | null;
  height_cm?: number | null;
  location?: string | null;
  protein_target?: number | null;
  role?: string | null;
  sex?: "male" | "female" | "other" | null;
};

type GoalPrimary = "lose" | "tone" | "gain"; // lose weight | tone up | gain weight

export default function OnboardingPage() {
  const { data: session } = useSession();
  const email = session?.user?.email || null;

  // ---- Local state (mirrors Users doc + goal info) ----
  const [step, setStep] = useState(0); // 0: metrics, 1: activity+goal, 2: equipment, 3: preferences, 4: finish
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<UsersDoc>({
    email,
    height_cm: null,
    weight_kg: null,
    bodyfat_pct: null,
    DOB: null,
    sex: null,
    activity_factor: 1.2, // default sedentary
    calorie_target: null,
    protein_target: null,
    carb_target: null,
    fat_target: null,
  });

  // lightweight client-only goal intensities
  const [goalPrimary, setGoalPrimary] = useState<GoalPrimary | null>(null);
  const [goalIntensity, setGoalIntensity] = useState<"small" | "large" | "maint" | "lean">("maint");

  // Equipment and preferences (used to tailor workouts later)
  const [equipment, setEquipment] = useState<{ bodyweight: boolean; kettlebell: boolean; dumbbell: boolean }>({
    bodyweight: true,
    kettlebell: false,
    dumbbell: false,
  });
  const [preferences, setPreferences] = useState<{ boxing_focus: boolean; kettlebell_focus: boolean; schedule_days: number }>({
    boxing_focus: true,
    kettlebell_focus: true,
    schedule_days: 3,
  });

  // ---- Load Users doc ----
  const { data, error, isLoading } = useSWR(
    email ? `/api/profile?email=${encodeURIComponent(email)}` : null,
    fetcher
  );

  useEffect(() => {
    if (data && typeof data === "object") {
      setProfile((prev) => ({
        ...prev,
        ...data,
        email,
      }));
      // If doc already has targets, keep them as initial values
      if (data.calorie_target || data.protein_target || data.carb_target || data.fat_target) {
        setSavedMsg("Targets loaded");
      }
    }
  }, [data, email]);

  // ---- Utilities ------------------------------------------------------------
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

  function computeTargets(p: UsersDoc, goal: GoalPrimary | null, intensity: typeof goalIntensity) {
    const weight = Number(p.weight_kg ?? 0);
    const height = Number(p.height_cm ?? 0);
    const sex = p.sex ?? "other";
    const age = computeAge(p.DOB) ?? 30;
    const af = Number(p.activity_factor ?? 1.2);

    if (!(weight > 0 && height > 0 && af > 0)) {
      return { calorie_target: null, protein_target: null, carb_target: null, fat_target: null };
    }

    // Mifflin-St Jeor
    const bmr =
      sex === "male"
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : sex === "female"
        ? 10 * weight + 6.25 * height - 5 * age - 161
        : 10 * weight + 6.25 * height - 5 * age;

    let tdee = bmr * af;

    // Goal adjustment
    // lose: small -10%, large -20%
    // tone (maintenance / recomp): 0%
    // gain: lean +10%
    if (goal === "lose") {
      tdee *= intensity === "large" ? 0.8 : 0.9;
    } else if (goal === "tone") {
      tdee *= 1.0;
    } else if (goal === "gain") {
      tdee *= intensity === "lean" ? 1.10 : 1.10; // keep lean bulk +10%
    }

    // Macros
    // Protein: 2.0 g/kg for lose, 1.8 g/kg for tone/gain
    const proteinG = Math.round((goal === "lose" ? 2.0 : 1.8) * weight);
    // Fat: 0.8 g/kg (clamped 40–120g)
    const fatG = Math.round(Math.min(120, Math.max(40, 0.8 * weight)));
    // Carbs from remainder calories: kcal = P*4 + C*4 + F*9
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

    // compute new targets (only when we have enough info)
    const targets = computeTargets(profile, goalPrimary, goalIntensity);

    try {
      const res = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Users doc fields only
          email,
          sex: profile.sex ?? null,
          height_cm: profile.height_cm ?? null,
          weight_kg: profile.weight_kg ?? null,
          bodyfat_pct: profile.bodyfat_pct ?? null,
          DOB: profile.DOB ?? null,
          activity_factor: profile.activity_factor ?? 1.2,

          // computed targets
          calorie_target: targets.calorie_target,
          protein_target: targets.protein_target,
          carb_target: targets.carb_target,
          fat_target: targets.fat_target,

          // optional location/gym/role passthrough (keep unchanged if absent)
          gym_id: profile.gym_id ?? null,
          location: profile.location ?? null,
          role: profile.role ?? null,

          // add equipment/preferences as nested extras (harmless to Users):
          equipment,
          preferences,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");

      // reflect computed targets in local profile and show preview
      setProfile((prev) => ({
        ...prev,
        calorie_target: targets.calorie_target,
        protein_target: targets.protein_target,
        carb_target: targets.carb_target,
        fat_target: targets.fat_target,
      }));
      setSavedMsg("Saved ✅");

      if (typeof nextStep === "number") setStep(Math.max(0, Math.min(4, nextStep)));
    } catch (e: any) {
      setSavedMsg(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!email) {
    return (
      <>
        <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">Welcome to BXKR</h5>
            <p className="text-dim mb-3">Please sign in to personalise your training.</p>
            <button className="btn btn-bxkr" onClick={() => signIn("google")}>Sign in with Google</button>
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

  // convenience values for showing targets
  const canShowTargets =
    (profile.height_cm ?? 0) > 0 &&
    (profile.weight_kg ?? 0) > 0 &&
    !!profile.activity_factor &&
    !!goalPrimary;

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 className="mb-0" style={{ fontWeight: 700 }}>Let’s tailor BXKR to you</h2>
          <div className="text-dim">Step {step + 1} / 5</div>
        </div>

        {savedMsg && <div className="pill-success mb-3">{savedMsg}</div>}

        {/* Step 1: Metrics */}
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

        {/* Step 2: Activity + Goal */}
        {step === 1 && (
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">Daily activity & goal</h5>
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
                  value={goalPrimary ?? ""}
                  onChange={(e) => setGoalPrimary((e.target.value || null) as GoalPrimary)}
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
                  value={goalIntensity}
                  onChange={(e) =>
                    setGoalIntensity(
                      (e.target.value as typeof goalIntensity) || "maint"
                    )
                  }
                >
                  {/* map to small/large cut, maintenance, lean bulk */}
                  {goalPrimary === "lose" && (
                    <>
                      <option value="small">Small cut</option>
                      <option value="large">Larger cut</option>
                    </>
                  )}
                  {goalPrimary === "tone" && (
                    <>
                      <option value="maint">Maintenance / recomp</option>
                    </>
                  )}
                  {goalPrimary === "gain" && (
                    <>
                      <option value="lean">Lean gain</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Targets preview (after save) */}
            {canShowTargets && profile.calorie_target && (
              <div className="bxkr-card p-3 mt-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="fw-semibold mb-1">Targets (per day)</div>
                <div className="small">
                  <div>Calories: <strong>{profile.calorie_target}</strong> kcal</div>
                  <div>Protein: <strong>{profile.protein_target}</strong> g</div>
                  <div>Carbs: <strong>{profile.carb_target}</strong> g</div>
                  <div>Fat: <strong>{profile.fat_target}</strong> g</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Equipment */}
        {step === 2 && (
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">Equipment at home</h5>
            <div className="row g-2">
              <div className="col-4">
                <label className="form-label small text-dim">Bodyweight</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!equipment.bodyweight}
                  onChange={(e) => setEquipment({ ...equipment, bodyweight: e.target.checked })}
                />
              </div>
              <div className="col-4">
                <label className="form-label small text-dim">Kettlebell</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!equipment.kettlebell}
                  onChange={(e) => setEquipment({ ...equipment, kettlebell: e.target.checked })}
                />
              </div>
              <div className="col-4">
                <label className="form-label small text-dim">Dumbbell</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!equipment.dumbbell}
                  onChange={(e) => setEquipment({ ...equipment, dumbbell: e.target.checked })}
                />
              </div>
            </div>
            <div className="small text-dim mt-2">
              BXKR workouts include Bodyweight, Kettlebell, and Dumbbell variants.
            </div>
          </div>
        )}

        {/* Step 4: Preferences */}
        {step === 3 && (
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">Preferences</h5>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small text-dim">Boxing emphasis</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!preferences.boxing_focus}
                  onChange={(e) => setPreferences({ ...preferences, boxing_focus: e.target.checked })}
                />
              </div>
              <div className="col-6">
                <label className="form-label small text-dim">Kettlebell emphasis</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!preferences.kettlebell_focus}
                  onChange={(e) => setPreferences({ ...preferences, kettlebell_focus: e.target.checked })}
                />
              </div>
              <div className="col-12 mt-2">
                <label className="form-label small text-dim">Target sessions per week</label>
                <select
                  className="form-select"
                  value={preferences.schedule_days}
                  onChange={(e) => setPreferences({ ...preferences, schedule_days: Number(e.target.value) })}
                >
                  {[2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Finish */}
        {step === 4 && (
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">All set!</h5>
            <p className="text-dim">
              BXKR will tailor your workouts and tasks based on your metrics, goals, and equipment.
            </p>
          </div>
        )}

        {/* Controls: Back / Next only (Next auto-saves) */}
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
                // Auto-save then advance
                autoSave(next);
              } else {
                // Final: save then go home
                autoSave();
                window.location.href = "/";
              }
            }}
            disabled={saving}
            aria-label={step < 4 ? "Next" : "Finish"}
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
