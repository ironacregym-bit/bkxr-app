// pages/profile.tsx

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import BottomNav from "../components/BottomNav";

type Profile = {
  DOB: string;
  activity_factor: number | null;
  bodyfat_pct: number | null;
  caloric_target: number | null;
  height_cm: number | null;
  image: string;
  location: string;
  name: string;
  sex: string;
  weight_kg: number | null;

  created_at: string;
  email: string;
  last_login_at: string;

  subscription_status?: string;
  is_premium?: boolean;
  trial_end?: string | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function toNumberOrNull(val: string): number | null {
  const trimmed = (val ?? "").trim();
  if (trimmed === "") return null;

  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function toYMDOrEmpty(isoLike?: string) {
  if (!isoLike) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoLike)) return isoLike;

  const d = new Date(isoLike);
  if (isNaN(d.getTime())) return "";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${dd}`;
}

function daysLeft(iso?: string | null) {
  if (!iso) return null;

  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;

  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function getInitials(nameOrEmail: string) {
  const cleaned = String(nameOrEmail || "").trim();

  if (!cleaned) return "IA";

  const namePart = cleaned.includes("@") ? cleaned.split("@")[0] : cleaned;
  const parts = namePart
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return namePart.slice(0, 2).toUpperCase();
}

function statusText(status: string, trialEnd?: string | null) {
  const normalised = String(status || "none").toLowerCase();
  const rem = daysLeft(trialEnd);

  if (normalised === "active") return "Active";
  if (normalised === "trialing") {
    if (rem == null) return "Trial";
    if (rem <= 0) return "Trial ends today";
    return `Trial • ${rem} day${rem === 1 ? "" : "s"} left`;
  }

  if (normalised === "past_due") return "Payment due";
  if (normalised === "paused") return "Paused";
  if (normalised === "canceled") return "Cancelled";
  if (normalised === "trial_ended") return "Trial ended";

  return "Member";
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const email = String(session?.user?.email || "").trim().toLowerCase();

  const { data, error, isLoading, mutate } = useSWR<Profile>(
    email ? `/api/profile?email=${encodeURIComponent(email)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;

    setFormData({
      DOB: toYMDOrEmpty(data.DOB),
      activity_factor: data.activity_factor ?? null,
      bodyfat_pct: data.bodyfat_pct ?? null,
      caloric_target: data.caloric_target ?? null,
      created_at: data.created_at ?? "",
      email: data.email ?? email,
      height_cm: data.height_cm ?? null,
      image: data.image ?? "",
      last_login_at: data.last_login_at ?? "",
      name: data.name ?? "",
      sex: data.sex ?? "",
      weight_kg: data.weight_kg ?? null,
      location: data.location ?? "",
      subscription_status: data.subscription_status,
      is_premium: data.is_premium,
      trial_end: data.trial_end ?? null,
    });
  }, [data, email]);

  useEffect(() => {
    const { weight_kg, height_cm, DOB, sex, activity_factor } = formData;

    if (weight_kg && height_cm && DOB && sex && activity_factor) {
      const birthDate = new Date(DOB);
      const today = new Date();

      let age = 30;

      if (!isNaN(birthDate.getTime())) {
        age = today.getFullYear() - birthDate.getFullYear();

        const monthDiff = today.getMonth() - birthDate.getMonth();
        const birthdayNotPassed =
          monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate());

        if (birthdayNotPassed) age -= 1;
      }

      const base =
        sex.toLowerCase() === "male"
          ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
          : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;

      const target = Math.round(base * activity_factor);

      setFormData((prev) => ({
        ...prev,
        caloric_target: target,
      }));
    }
  }, [
    formData.weight_kg,
    formData.height_cm,
    formData.DOB,
    formData.sex,
    formData.activity_factor,
  ]);

  const displayName = formData.name || session?.user?.name || "Iron Acre Athlete";
  const displayEmail = email || "Not signed in";
  const displayImage = formData.image || session?.user?.image || "";
  const initials = getInitials(displayName || displayEmail);

  const subStatus = useMemo(
    () => String(formData.subscription_status || "none").toLowerCase(),
    [formData.subscription_status]
  );

  const memberStatusLabel = statusText(subStatus, formData.trial_end ?? null);

  const completionScore = useMemo(() => {
    const checks = [
      Boolean(String(formData.name || "").trim()),
      Boolean(String(formData.DOB || "").trim()),
      Boolean(String(formData.sex || "").trim()),
      Number(formData.height_cm || 0) > 0,
      Number(formData.weight_kg || 0) > 0,
      Number(formData.activity_factor || 0) > 0,
    ];

    const completed = checks.filter(Boolean).length;

    return {
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100),
    };
  }, [formData]);

  function handleTextChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleNumberChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: toNumberOrNull(value),
    }));
  }

  async function handleUpdate() {
    if (!email) {
      alert("You need to be signed in to update your profile.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          DOB: formData.DOB ?? "",
          activity_factor: formData.activity_factor ?? null,
          bodyfat_pct: formData.bodyfat_pct ?? null,
          caloric_target: formData.caloric_target ?? null,
          created_at: formData.created_at ?? "",
          email,
          height_cm: formData.height_cm ?? null,
          image: formData.image ?? "",
          last_login_at: formData.last_login_at ?? "",
          name: formData.name ?? "",
          sex: formData.sex ?? "",
          weight_kg: formData.weight_kg ?? null,
          location: formData.location ?? "",
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Profile update failed.");
      }

      const updated = json as Profile;

      setFormData((prev) => ({
        ...prev,
        ...updated,
        DOB: toYMDOrEmpty(updated.DOB),
      }));

      await mutate();

      alert("Profile updated.");
    } catch (err: any) {
      console.error("[profile/update]", err?.message || err);
      alert(err?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: "/register" });
  }

  return (
    <>
      <Head>
        <title>Iron Acre • Profile</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-2 ia-profile-page">
        <section className="ia-profile-hero">
          <div className="ia-profile-topline">
            <Link href="/iron-acre" className="ia-profile-back">
              <i className="fas fa-chevron-left" />
               Dashboard
            </Link>

            <span className={`ia-profile-status ia-profile-status-${subStatus}`}>
              {memberStatusLabel}
            </span>
          </div>

          <div className="ia-profile-identity">
            <div className="ia-profile-avatar-wrap">
              {displayImage ? (
                <img src={displayImage} alt="Profile" className="ia-profile-avatar" />
              ) : (
                <div className="ia-profile-avatar ia-profile-avatar-fallback">{initials}</div>
              )}
            </div>

            <div className="ia-profile-name-block">
              <div className="ia-profile-kicker">Iron Acre account</div>
              <h1 className="ia-page-title">{displayName}</h1>
              <p>{displayEmail}</p>
            </div>
          </div>

          <div className="ia-profile-progress">
            <div className="ia-profile-progress-copy">
              <span>Profile setup</span>
              <strong>
                {completionScore.completed}/{completionScore.total}
              </strong>
            </div>

            <div className="ia-profile-progress-track">
              <div
                className="ia-profile-progress-fill"
                style={{ width: `${completionScore.percent}%` }}
              />
            </div>
          </div>
        </section>

        <section className="ia-profile-action-grid">
          <Link href="/onboarding?returnTo=%2Firon-acre" className="ia-profile-action-card">
            <span className="ia-profile-action-icon">
              <i className="fas fa-rotate-right" />
            </span>
            <span>
              <strong>Redo onboarding </strong>
              <small>Update goals, body data and setup details.</small>
            </span>
          </Link>

          <Link href="/nutrition" className="ia-profile-action-card">
            <span className="ia-profile-action-icon">
              <i className="fas fa-bowl-food" />
            </span>
            <span>
              <strong>Nutrition goal </strong>
              <small>Change To Your Own Macros</small>
            </span>
          </Link>

          <Link href="/train" className="ia-profile-action-card">
            <span className="ia-profile-action-icon">
              <i className="fas fa-dumbbell" />
            </span>
            <span>
              <strong >Training programme </strong>
              <small>Switch your current workout programme.</small>
            </span>
          </Link>
        </section>

        <section className="ia-profile-card">
          <div className="ia-profile-section-head">
            <div>
              <div className="ia-profile-kicker">Personal</div>
              <h2 className="ia-page-title">Your details</h2>
            </div>
            <span className="ia-profile-mini-note">Used to personalise your app experience</span>
          </div>

          {status === "loading" ? (
            <div className="ia-profile-state">Loading session…</div>
          ) : null}

          {status === "unauthenticated" ? (
            <div className="ia-profile-state ia-profile-state-warning">
              Please sign in to view and update your profile.
            </div>
          ) : null}

          {isLoading ? <div className="ia-profile-state">Loading profile…</div> : null}

          {error ? (
            <div className="ia-profile-state ia-profile-state-error">
              Failed to load profile.
            </div>
          ) : null}

          {data ? (
            <form className="ia-profile-form">
              <div className="ia-profile-field">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name ?? ""}
                  onChange={handleTextChange}
                  placeholder="Your name"
                />
              </div>

              <div className="ia-profile-field-grid">
                <div className="ia-profile-field">
                  <label>Date of birth</label>
                  <input
                    type="date"
                    name="DOB"
                    value={toYMDOrEmpty(formData.DOB)}
                    onChange={handleTextChange}
                  />
                </div>

                <div className="ia-profile-field">
                  <label>Sex</label>
                  <select name="sex" value={formData.sex ?? ""} onChange={handleTextChange}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="ia-profile-field">
                <label>Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location ?? ""}
                  onChange={handleTextChange}
                  placeholder="Town or city"
                />
              </div>

              <div className="ia-profile-field">
                <label>Image URL</label>
                <input
                  type="text"
                  name="image"
                  value={formData.image ?? ""}
                  onChange={handleTextChange}
                  placeholder="https://..."
                />
              </div>
            </form>
          ) : null}
        </section>

        {data ? (
          <section className="ia-profile-card">
            <div className="ia-profile-section-head">
              <div>
                <div className="ia-profile-kicker">Metrics</div>
                <h2 className="ia-page-title">Body data</h2>
              </div>
              <span className="ia-profile-mini-note">Keeps nutrition targets accurate</span>
            </div>

            <form className="ia-profile-form">
              <div className="ia-profile-field-grid">
                <div className="ia-profile-field">
                  <label>Height</label>
                  <div className="ia-profile-input-unit">
                    <input
                      type="number"
                      step="1"
                      name="height_cm"
                      value={formData.height_cm ?? ""}
                      onChange={handleNumberChange}
                      placeholder="180"
                    />
                    <span>cm</span>
                  </div>
                </div>

                <div className="ia-profile-field">
                  <label>Weight</label>
                  <div className="ia-profile-input-unit">
                    <input
                      type="number"
                      step="0.1"
                      name="weight_kg"
                      value={formData.weight_kg ?? ""}
                      onChange={handleNumberChange}
                      placeholder="82"
                    />
                    <span>kg</span>
                  </div>
                </div>
              </div>

              <div className="ia-profile-field-grid">
                <div className="ia-profile-field">
                  <label>Body fat</label>
                  <div className="ia-profile-input-unit">
                    <input
                      type="number"
                      step="0.1"
                      name="bodyfat_pct"
                      value={formData.bodyfat_pct ?? ""}
                      onChange={handleNumberChange}
                      placeholder="18"
                    />
                    <span>%</span>
                  </div>
                </div>

                <div className="ia-profile-field">
                  <label>Activity factor</label>
                  <select
                    name="activity_factor"
                    value={formData.activity_factor ?? ""}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        activity_factor: toNumberOrNull(e.target.value),
                      }));
                    }}
                  >
                    <option value="">Select</option>
                    <option value="1.2">Low activity</option>
                    <option value="1.375">Light training</option>
                    <option value="1.55">Moderate training</option>
                    <option value="1.725">Hard training</option>
                    <option value="1.9">Very active</option>
                  </select>
                </div>
              </div>

              <div className="ia-profile-target-box">
                <span>Estimated daily target</span>
                <strong>
                  {formData.caloric_target ? `${formData.caloric_target} kcal` : "Add metrics"}
                </strong>
              </div>
            </form>
          </section>
        ) : null}

        {data ? (
          <section className="ia-profile-card">
            <div className="ia-profile-section-head">
              <div>
                <div className="ia-profile-kicker">System</div>
                <h2>Account info</h2>
              </div>
              <span className="ia-profile-mini-note">Read-only</span>
            </div>
        
            <div className="ia-profile-system-list">
              <div>
                <span>Email</span>
                <strong>{email || "Not available"}</strong>
              </div>
        
              <div>
                <span>Created</span>
                <strong>{formData.created_at || "Not available"}</strong>
              </div>
        
              <div>
                <span>Last login</span>
                <strong>{formData.last_login_at || "Not available"}</strong>
              </div>
            </div>
          </section>
        ) : null}

        {data ? (
          <section className="ia-profile-save-bar">
            <button
              type="button"
              className="ia-profile-save-btn"
              onClick={handleUpdate}
              disabled={saving || status !== "authenticated"}
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  Saving
                </>
              ) : (
                <>
                  <i className="fas fa-check" />
                  Save profile
                </>
              )}
            </button>

            <button
              type="button"
              className="ia-profile-secondary-btn"
              onClick={() => router.push("/billing")}
              disabled={status !== "authenticated"}
            >
              Billing
            </button>

            <button type="button" className="ia-profile-signout-btn" onClick={handleSignOut}>
              Sign out
            </button>
          </section>
        ) : null}
      </main>

      <BottomNav />

      <style jsx>{`
        .ia-profile-page {
          min-height: 100vh;
          padding-bottom: 104px;
          color: #ffffff;
        }

        .ia-profile-hero,
        .ia-profile-card,
        .ia-profile-action-card,
        .ia-profile-save-bar {
          border: 1px solid rgba(255, 255, 255, 0.09);
          background:
            radial-gradient(circle at 20% 0%, rgba(24, 255, 154, 0.09), transparent 34%),
            linear-gradient(180deg, rgba(17, 22, 28, 0.98) 0%, rgba(9, 13, 18, 0.98) 100%);
          box-shadow: 0 16px 44px rgba(0, 0, 0, 0.34);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .ia-profile-hero {
          border-radius: 26px;
          padding: 16px;
          margin-bottom: 10px;
        }

        .ia-profile-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 16px;
        }

        .ia-profile-back {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: rgba(255, 255, 255, 0.76);
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
        }

        .ia-profile-back i {
          color: #18ff9a;
          font-size: 11px;
        }

        .ia-profile-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 11px;
          border-radius: 999px;
          border: 1px solid rgba(24, 255, 154, 0.24);
          background: rgba(24, 255, 154, 0.1);
          color: #ddfff3;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .ia-profile-status-past_due,
        .ia-profile-status-canceled,
        .ia-profile-status-trial_ended {
          border-color: rgba(255, 120, 120, 0.26);
          background: rgba(255, 120, 120, 0.1);
          color: #ffd1d1;
        }

        .ia-profile-identity {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .ia-profile-avatar-wrap {
          flex: 0 0 auto;
        }

        .ia-profile-avatar {
          width: 74px;
          height: 74px;
          border-radius: 24px;
          object-fit: cover;
          border: 1px solid rgba(24, 255, 154, 0.26);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 0 24px rgba(24, 255, 154, 0.12);
        }

        .ia-profile-avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #07251a;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0.04em;
          background: linear-gradient(135deg, #18ff9a 0%, #00d97a 100%);
        }

        .ia-profile-name-block {
          min-width: 0;
          flex: 1;
        }

        .ia-profile-kicker {
          color: #18ff9a;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .ia-profile-name-block h1,
        .ia-profile-section-head h2 {
          margin: 0;
          color: #ffffff;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .ia-profile-name-block h1 {
          font-size: clamp(1.45rem, 7vw, 2.1rem);
          line-height: 1;
        }

        .ia-profile-name-block p {
          margin: 5px 0 0;
          color: rgba(255, 255, 255, 0.58);
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ia-profile-progress {
          border-radius: 18px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.07);
        }

        .ia-profile-progress-copy {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: rgba(255, 255, 255, 0.68);
          font-size: 13px;
          margin-bottom: 9px;
        }

        .ia-profile-progress-copy strong {
          color: #ffffff;
        }

        .ia-profile-progress-track {
          width: 100%;
          height: 8px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.08);
        }

        .ia-profile-progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #18ff9a 0%, #00d97a 100%);
          box-shadow: 0 0 18px rgba(24, 255, 154, 0.24);
        }

        .ia-profile-action-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }

        .ia-profile-action-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px;
          border-radius: 20px;
          color: #ffffff;
          text-decoration: none;
        }

        .ia-profile-action-icon {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          color: #18ff9a;
          background: rgba(24, 255, 154, 0.1);
          border: 1px solid rgba(24, 255, 154, 0.18);
        }

        .ia-profile-action-card strong {
          display: block;
          font-size: 14px;
          line-height: 1.2;
        }

        .ia-profile-action-card small {
          display: block;
          margin-top: 3px;
          color: rgba(255, 255, 255, 0.58);
          font-size: 12px;
          line-height: 1.35;
        }

        .ia-profile-card {
          border-radius: 24px;
          padding: 15px;
          margin-bottom: 10px;
        }

        .ia-profile-section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .ia-profile-section-head h2 {
          font-size: 1.15rem;
          line-height: 1.1;
        }

        .ia-profile-mini-note {
          color: rgba(255, 255, 255, 0.48);
          font-size: 11px;
          line-height: 1.35;
          text-align: right;
          max-width: 140px;
        }

        .ia-profile-form {
          display: grid;
          gap: 11px;
        }

        .ia-profile-field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }

        .ia-profile-field {
          display: grid;
          gap: 6px;
        }

        .ia-profile-field label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 800;
        }

        .ia-profile-field input,
        .ia-profile-field select {
          width: 100%;
          min-height: 44px;
          border-radius: 15px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.055);
          color: #ffffff;
          padding: 0 12px;
          outline: none;
          font-size: 14px;
        }

        .ia-profile-field select {
          appearance: none;
        }

        .ia-profile-field input:focus,
        .ia-profile-field select:focus {
          border-color: rgba(24, 255, 154, 0.38);
          box-shadow: 0 0 0 3px rgba(24, 255, 154, 0.08);
        }

        .ia-profile-field input::placeholder {
          color: rgba(255, 255, 255, 0.32);
        }

        .ia-profile-field select option {
          color: #111111;
        }

        .ia-profile-input-unit {
          position: relative;
        }

        .ia-profile-input-unit input {
          padding-right: 48px;
        }

        .ia-profile-input-unit span {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.46);
          font-size: 12px;
          font-weight: 800;
          pointer-events: none;
        }

        .ia-profile-target-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 13px;
          border-radius: 18px;
          border: 1px solid rgba(24, 255, 154, 0.18);
          background: rgba(24, 255, 154, 0.08);
        }

        .ia-profile-target-box span {
          color: rgba(255, 255, 255, 0.62);
          font-size: 13px;
          font-weight: 700;
        }

        .ia-profile-target-box strong {
          color: #ddfff3;
          font-size: 18px;
          font-weight: 900;
          white-space: nowrap;
        }

        .ia-profile-system-list {
          display: grid;
          gap: 8px;
        }

        .ia-profile-system-list div {
          display: grid;
          gap: 3px;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.07);
        }

        .ia-profile-system-list span {
          color: rgba(255, 255, 255, 0.46);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .ia-profile-system-list strong {
          color: rgba(255, 255, 255, 0.86);
          font-size: 13px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .ia-profile-state {
          border-radius: 16px;
          padding: 13px;
          color: rgba(255, 255, 255, 0.74);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 14px;
        }

        .ia-profile-state-warning {
          color: #ffe2b8;
          background: rgba(255, 158, 87, 0.1);
          border-color: rgba(255, 158, 87, 0.2);
        }

        .ia-profile-state-error {
          color: #ffd1d1;
          background: rgba(255, 120, 120, 0.1);
          border-color: rgba(255, 120, 120, 0.2);
        }

        .ia-profile-save-bar {
          position: sticky;
          bottom: 76px;
          z-index: 20;
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 8px;
          padding: 10px;
          border-radius: 22px;
          background:
            linear-gradient(180deg, rgba(15, 20, 25, 0.96) 0%, rgba(8, 12, 16, 0.96) 100%);
        }

        .ia-profile-save-btn,
        .ia-profile-secondary-btn,
        .ia-profile-signout-btn {
          min-height: 42px;
          border-radius: 999px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
        }

        .ia-profile-save-btn {
          color: #06251a;
          background: linear-gradient(135deg, #18ff9a 0%, #00d97a 100%);
          box-shadow: 0 0 22px rgba(24, 255, 154, 0.18);
        }

        .ia-profile-save-btn:disabled,
        .ia-profile-secondary-btn:disabled {
          opacity: 0.55;
        }

        .ia-profile-secondary-btn {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ia-profile-signout-btn {
          color: #ffd1d1;
          background: rgba(255, 120, 120, 0.09);
          border: 1px solid rgba(255, 120, 120, 0.16);
        }

        @media (max-width: 420px) {
          .ia-profile-hero {
            padding: 14px;
            border-radius: 24px;
          }

          .ia-profile-identity {
            gap: 12px;
          }

          .ia-profile-avatar {
            width: 64px;
            height: 64px;
            border-radius: 21px;
          }

          .ia-profile-field-grid {
            grid-template-columns: 1fr;
          }

          .ia-profile-section-head {
            align-items: flex-start;
          }

          .ia-profile-mini-note {
            display: none;
          }

          .ia-profile-save-bar {
            grid-template-columns: 1fr;
            bottom: 74px;
          }

          .ia-profile-secondary-btn,
          .ia-profile-signout-btn {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
