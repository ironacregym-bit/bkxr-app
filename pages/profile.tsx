
// pages/profile.tsx
"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

type Profile = {
  // User-entered fields
  DOB: string;
  activity_factor: number | null;
  bodyfat_pct: number | null;
  caloric_target: number | null; // UI field (API aliases to calorie_target)
  height_cm: number | null;
  image: string;
  location: string;
  name: string;
  sex: string;
  weight_kg: number | null;

  // System / mirrored fields
  created_at: string;
  email: string;
  last_login_at: string;

  // Optional billing mirrors if /api/profile returns them
  subscription_status?: string; // active|trialing|past_due|paused|canceled|trial_ended|none
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

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? "";

  // Load profile (same API shape; only fetch when email exists)
  const { data, error, isLoading, mutate } = useSWR<Profile>(
    email ? `/api/profile?email=${encodeURIComponent(email)}` : null,
    fetcher
  );

  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);

  // Hydrate form from API
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
      // mirrored billing fields if present
      subscription_status: data.subscription_status,
      is_premium: data.is_premium,
      trial_end: data.trial_end ?? null,
    });
  }, [data, email]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: toNumberOrNull(value) }));
  };

  // Auto-calc caloric target when inputs change
  useEffect(() => {
    const { weight_kg, height_cm, DOB, sex, activity_factor } = formData;
    if (weight_kg && height_cm && DOB && sex && activity_factor) {
      const birthDate = new Date(DOB);
      const today = new Date();
      let age = 30;
      if (!isNaN(birthDate.getTime())) {
        age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      }
      const base =
        sex.toLowerCase() === "male"
          ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
          : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
      const target = Math.round(base * activity_factor);
      setFormData((prev) => ({ ...prev, caloric_target: target }));
    }
  }, [formData.weight_kg, formData.height_cm, formData.DOB, formData.sex, formData.activity_factor]);

  const subStatus = useMemo(
    () => (formData.subscription_status || "none").toLowerCase(),
    [formData.subscription_status]
  );
  const rem = daysLeft(formData.trial_end ?? undefined);
  const onBilling = () => router.push("/billing");

  // Derived display name/image (falls back to session)
  const displayName = formData.name || session?.user?.name || "Your Name";
  const displayImage =
    (formData.image && formData.image !== "" ? formData.image : undefined) ||
    session?.user?.image ||
    "/default-avatar.png";

  // Build status pill text
  const statusLabel =
    subStatus === "active"
      ? "Active"
      : subStatus === "trialing"
      ? rem != null
        ? `Trialing • ${rem > 0 ? `${rem} day${rem === 1 ? "" : "s"} left` : "ends today"}`
        : "Trialing"
      : subStatus.replace("_", " ") || "Free tier";

  async function handleUpdate() {
    if (!email) {
      alert("❌ Not signed in.");
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
          caloric_target: formData.caloric_target ?? null, // API accepts alias
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
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem?.error ?? "Update failed");
      }
      const updated: Profile = await res.json();
      setFormData((prev) => ({
        ...prev,
        ...updated,
        DOB: toYMDOrEmpty(updated.DOB),
      }));
      mutate();
      alert("✅ Profile updated successfully!");
    } catch (err: any) {
      console.error("Profile update error:", err?.message || err);
      alert(`❌ Failed to update profile. ${err?.message || ""}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>BXKR • Profile</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container" style={{ paddingBottom: 90, minHeight: "80vh" }}>
        {/* HERO */}
        <section className="bxkr-card bxkr-hero mb-3">
          <div className="identity">
            <img src={displayImage} alt="Profile" />
            <div style={{ flex: 1 }}>
              <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>{displayName}</h4>
                  <div className="text-dim" style={{ fontSize: 13 }}>{email || "Not signed in"}</div>
                </div>
                <div>
                  <span className={`bxkr-status-pill bxkr-status-${subStatus}`}>{statusLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="actions">
            <button className="btn-bxkr" onClick={onBilling} disabled={status !== "authenticated"}>
              Go to Billing
            </button>
            {subStatus !== "active" && (
              <button className="btn-bxkr-outline" onClick={() => router.push("/paywall")}>
                Upgrade to Premium
              </button>
            )}
          </div>
        </section>

        {/* CONTENT CARD */}
        <section className="bxkr-card p-3">
          {/* States */}
          {status === "loading" && <div className="alert alert-secondary text-center">Loading session…</div>}
          {status === "unauthenticated" && (
            <div className="alert alert-warning text-center">
              Please sign in with Google to view and update your profile.
            </div>
          )}
          {isLoading && <div className="text-dim">Loading profile…</div>}
          {error && <div className="alert alert-danger text-center">Failed to load profile.</div>}

          {data && (
            <form>
              {/* Personal */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="m-0">Personal</h6>
                  <span className="text-dim" style={{ fontSize: 12 }}>These help personalise your programme</span>
                </div>
                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label">Name</label>
                    <input type="text" className="form-control" name="name" value={formData.name ?? ""} onChange={handleTextChange} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">DOB</label>
                    <input type="date" className="form-control" name="DOB" value={toYMDOrEmpty(formData.DOB)} onChange={handleTextChange} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Sex</label>
                    <input type="text" className="form-control" name="sex" value={formData.sex ?? ""} onChange={handleTextChange} placeholder="male / female" />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Location</label>
                    <input type="text" className="form-control" name="location" value={formData.location ?? ""} onChange={handleTextChange} placeholder="City, Country" />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Image URL</label>
                    <input type="text" className="form-control" name="image" value={formData.image ?? ""} onChange={handleTextChange} placeholder="https://…" />
                  </div>
                </div>
              </div>

              <hr />

              {/* Metrics */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="m-0">Metrics</h6>
                  <span className="text-dim" style={{ fontSize: 12 }}>Used to calculate target calories</span>
                </div>
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Height (cm)</label>
                    <input type="number" step="1" className="form-control" name="height_cm" value={formData.height_cm ?? ""} onChange={handleNumberChange} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Weight (kg)</label>
                    <input type="number" step="0.1" className="form-control" name="weight_kg" value={formData.weight_kg ?? ""} onChange={handleNumberChange} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Body Fat (%)</label>
                    <input type="number" step="0.1" className="form-control" name="bodyfat_pct" value={formData.bodyfat_pct ?? ""} onChange={handleNumberChange} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Activity Factor</label>
                    <input type="number" step="0.1" className="form-control" name="activity_factor" value={formData.activity_factor ?? ""} onChange={handleNumberChange} placeholder="e.g. 1.2 − 1.8" />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Caloric Target (auto)</label>
                    <input type="number" className="form-control" name="caloric_target" value={formData.caloric_target ?? ""} readOnly />
                  </div>
                </div>
              </div>

              <hr />

              {/* System (read-only) */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="m-0">System</h6>
                  <span className="text-dim" style={{ fontSize: 12 }}>Read‑only</span>
                </div>
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Email</label>
                    <input type="text" className="form-control" value={email || ""} readOnly />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Last login</label>
                    <input type="text" className="form-control" value={formData.last_login_at ?? ""} readOnly />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Created</label>
                    <input type="text" className="form-control" value={formData.created_at ?? ""} readOnly />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn-bxkr"
                  onClick={handleUpdate}
                  disabled={saving || status !== "authenticated"}
                >
                  {saving ? "Updating..." : "Update Profile"}
                </button>
                <button
                  type="button"
                  className="btn-bxkr-outline"
                  onClick={() => mutate()}
                  disabled={saving}
                >
                  Refresh
                </button>
              </div>
            </form>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}
