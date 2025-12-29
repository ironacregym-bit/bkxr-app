
// pages/onboarding.tsx
"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const ACCENT = "#FF8A2A";

type Profile = {
  email?: string;
  name?: string;
  image?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  DOB?: string | null;            // ISO
  sex?: "male" | "female" | "other" | "" | null;
  activity_factor?: number | null;
  job_type?: string | null;       // used to derive activity_factor
  goal_primary?: "cut" | "recomp" | "bulk" | null;
  goal_intensity?: "small_cut" | "large_cut" | "maintenance" | "lean_bulk" | null;
  equipment?: {
    bodyweight?: boolean;
    kettlebell?: boolean;
    dumbbell?: boolean;
  } | null;
  preferences?: {
    boxing_focus?: boolean;
    kettlebell_focus?: boolean;
    schedule_days?: number;       // e.g., 3, 4, 5
  } | null;
};

export default function OnboardingPage() {
  const { data: session } = useSession();
  const email = session?.user?.email || null;

  const { data, error, isLoading } = useSWR(
    email ? `/api/profile?email=${encodeURIComponent(email)}` : null,
    fetcher
  );

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>({
    height_cm: null,
    weight_kg: null,
    DOB: null,
    sex: null,
    activity_factor: null,
    job_type: null,
    goal_primary: null,
    goal_intensity: null,
    equipment: { bodyweight: true, kettlebell: false, dumbbell: false },
    preferences: { boxing_focus: true, kettlebell_focus: true, schedule_days: 3 },
  });

  useEffect(() => {
    if (data && typeof data === "object") {
      setProfile((prev) => ({
        ...prev,
        ...data,
        equipment: {
          bodyweight: data?.equipment?.bodyweight ?? prev.equipment?.bodyweight ?? true,
          kettlebell: data?.equipment?.kettlebell ?? prev.equipment?.kettlebell ?? false,
          dumbbell: data?.equipment?.dumbbell ?? prev.equipment?.dumbbell ?? false,
        },
        preferences: {
          boxing_focus: data?.preferences?.boxing_focus ?? prev.preferences?.boxing_focus ?? true,
          kettlebell_focus: data?.preferences?.kettlebell_focus ?? prev.preferences?.kettlebell_focus ?? true,
          schedule_days: data?.preferences?.schedule_days ?? prev.preferences?.schedule_days ?? 3,
        },
      }));
    }
  }, [data]);

  async function save() {
    if (!email) return signIn("google");
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");
      setSavedMsg("Saved ✅");
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

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 className="mb-0" style={{ fontWeight: 700 }}>Let’s tailor BXKR to you</h2>
          <div className="text-dim">Step {step + 1} / 5</div>
        </div>

        {savedMsg && (
          <div className="pill-success mb-3">{savedMsg}</div>
        )}

        {/* Step content */}
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
                  onChange={(e) => setProfile({ ...profile, sex: (e.target.value || null) as Profile["sex"] })}
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">Daily activity & goal</h5>
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label small text-dim">Job type (to set activity multiplier)</label>
                <select
                  className="form-select"
                  value={profile.job_type ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const map: Record<string, number> = {
                      sedentary: 1.2,
                      light: 1.375,
                      moderate: 1.55,
                      heavy: 1.725,
                      athlete: 1.9,
                    };
                    setProfile({
                      ...profile,
                      job_type: v,
                      activity_factor: map[v] ?? 1.2,
                    });
                  }}
                >
                  <option value="">Select…</option>
                  <option value="sedentary">Sedentary (mostly desk)</option>
                  <option value="light">Lightly active (walk/stand often)</option>
                  <option value="moderate">Moderately active</option>
                  <option value="heavy">Heavy labour</option>
                  <option value="athlete">Athlete / very active</option>
                </select>
                <div className="small text-dim mt-1">
                  Activity multiplier: {profile.activity_factor ?? "—"}
                </div>
              </div>

              <div className="col-6">
                <label className="form-label small text-dim">Main goal</label>
                <select
                  className="form-select"
                  value={profile.goal_primary ?? ""}
                  onChange={(e) => setProfile({ ...profile, goal_primary: (e.target.value || null) as any })}
                >
                  <option value="">Select…</option>
                  <option value="cut">Lose weight / cut</option>
                  <option value="recomp">Tone up / recomp</option>
                  <option value="bulk">Build muscle / bulk</option>
                </select>
              </div>

              <div className="col-6">
                <label className="form-label small text-dim">Intensity</label>
                <select
                  className="form-select"
                  value={profile.goal_intensity ?? ""}
                  onChange={(e) => setProfile({ ...profile, goal_intensity: (e.target.value || null) as any })}
                >
                  <option value="">Select…</option>
                  <option value="small_cut">Small cut</option>
                  <option value="large_cut">Larger cut</option>
                  <option value="maintenance">Maintenance / recomp</option>
                  <option value="lean_bulk">Lean bulk</option>
                </select>
              </div>
            </div>
          </div>
        )}

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
                  onChange={(e) => setProfile({ ...profile, equipment: { ...profile.equipment, bodyweight: e.target.checked } })}
                />
              </div>
              <div className="col-4">
                <label className="form-label small text-dim">Kettlebell</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!profile.equipment?.kettlebell}
                  onChange={(e) => setProfile({ ...profile, equipment: { ...profile.equipment, kettlebell: e.target.checked } })}
                />
              </div>
              <div className="col-4">
                <label className="form-label small text-dim">Dumbbell</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!profile.equipment?.dumbbell}
                  onChange={(e) => setProfile({ ...profile, equipment: { ...profile.equipment, dumbbell: e.target.checked } })}
                />
              </div>
            </div>
            <div className="small text-dim mt-2">
              BXKR workouts can be tailored to: Bodyweight, Kettlebell, and Dumbbell options.
            </div>
          </div>
        )}

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
                  onChange={(e) => setProfile({ ...profile, preferences: { ...profile.preferences, boxing_focus: e.target.checked } })}
                />
              </div>
              <div className="col-6">
                <label className="form-label small text-dim">Kettlebell emphasis</label><br />
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={!!profile.preferences?.kettlebell_focus}
                  onChange={(e) => setProfile({ ...profile, preferences: { ...profile.preferences, kettlebell_focus: e.target.checked } })}
                />
              </div>
              <div className="col-12 mt-2">
                <label className="form-label small text-dim">Target sessions per week</label>
                <select
                  className="form-select"
                  value={profile.preferences?.schedule_days ?? 3}
                  onChange={(e) => setProfile({ ...profile, preferences: { ...profile.preferences, schedule_days: Number(e.target.value) } })}
                >
                  {[2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="bxkr-card p-3 mb-3">
            <h5 className="mb-2">All set!</h5>
            <p className="text-dim">
              BXKR will now tailor your workouts and tasks. You can update any of these in your profile at any time.
            </p>
            <div className="d-flex gap-2">
              <button className="btn btn-bxkr" onClick={() => (window.location.href = "/")}>Go to Home</button>
              <button className="btn btn-bxkr-outline" onClick={() => (window.location.href = "/train")}>Go to Train</button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="d-flex justify-content-between">
          <button
            className="btn btn-bxkr-outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            ← Back
          </button>
          <div className="d-flex gap-2">
            <button className="btn btn-bxkr-outline" onClick={save} disabled={saving}>
              Save {saving && <span className="inline-spinner" />}
            </button>
            <button
              className="btn btn-bxkr"
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              Next →
            </button>
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
