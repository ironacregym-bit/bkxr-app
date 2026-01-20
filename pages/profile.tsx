
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

  // Optional billing mirrors if your /api/profile returns them
  subscription_status?: string;    // active|trialing|past_due|paused|canceled|trial_ended|none
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
  // If already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoLike)) return isoLike;
  // Try to parse
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
  const d = Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
  return d;
}

function StatusPill({ status, trialEnd }: { status?: string; trialEnd?: string | null }) {
  const s = (status || "none").toLowerCase();
  const rem = daysLeft(trialEnd || undefined);

  const palette: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: "rgba(46, 204, 113, 0.2)", fg: "#2ecc71", label: "Active" },
    trialing: { bg: "rgba(241, 196, 15, 0.2)", fg: "#f1c40f", label: rem != null ? `Trialing • ${rem > 0 ? `${rem} day${rem === 1 ? "" : "s"} left` : "ends today"}` : "Trialing" },
    past_due: { bg: "rgba(231, 76, 60, 0.2)", fg: "#e74c3c", label: "Past due" },
    paused: { bg: "rgba(52, 152, 219, 0.2)", fg: "#3498db", label: "Paused" },
    canceled: { bg: "rgba(149, 165, 166, 0.2)", fg: "#95a5a6", label: "Canceled" },
    trial_ended: { bg: "rgba(149, 165, 166, 0.2)", fg: "#95a5a6", label: "Trial ended" },
    none: { bg: "rgba(149, 165, 166, 0.2)", fg: "#95a5a6", label: "Free tier" },
  };

  const { bg, fg, label } = palette[s] || palette.none;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 12px",
        borderRadius: 20,
        background: bg,
        color: fg,
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: 0.3,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? "";

  // Load profile (keep your existing shape)
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
      // soft mirror billing if present
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

  const subStatus = useMemo(() => (formData.subscription_status || "none").toLowerCase(), [formData.subscription_status]);
  const onBilling = () => router.push("/billing");

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

      <main
        className="container"
        style={{
          minHeight: "80vh",
          paddingBottom: 90,
          background: "linear-gradient(135deg, #0b0f14 0%, #1b0f08 45%, #0b0f14 100%)",
          color: "#fff",
          borderRadius: 12,
          paddingTop: 16,
        }}
      >
        {/* Hero */}
        <section
          className="mb-3"
          style={{
            background: "radial-gradient(1200px 300px at 10% -10%, rgba(255,138,42,0.15), transparent), rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <img
              src={
                (formData.image && formData.image !== "" ? formData.image : undefined) ||
                session?.user?.image ||
                "/default-avatar.png"
              }
              alt="Profile"
              className="rounded-circle border"
              style={{ width: 72, height: 72, objectFit: "cover", borderColor: "rgba(255,255,255,0.25)" }}
            />
            <div className="flex-grow-1">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>{formData.name || session?.user?.name || "Your Name"}</h4>
                  <div style={{ opacity: 0.7, fontSize: 13 }}>{email || "Not signed in"}</div>
                </div>
                <div>
                  <StatusPill status={formData.subscription_status} trialEnd={formData.trial_end ?? null} />
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 mt-3 flex-wrap">
            <button
              className="bxkr-btn"
              onClick={onBilling}
              style={{
                borderRadius: 24,
                background: "linear-gradient(90deg, #ff7f32, #ff9f58)",
                color: "#0b0f14",
                fontWeight: 700,
                border: "none",
                boxShadow: "0 0 20px rgba(255,127,50,0.45)",
              }}
            >
              Go to Billing
            </button>
            {subStatus !== "active" && (
              <button
                className="btn-bxkr-outline"
                onClick={() => router.push("/paywall")}
                style={{ borderRadius: 24 }}
              >
                Upgrade to Premium
              </button>
            )}
          </div>
        </section>

        {/* Content */}
        <section
          className="p-3"
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: 16,
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Loading / errors */}
          {status === "loading" && (
            <div className="alert alert-secondary text-center">Loading session…</div>
          )}
          {status === "unauthenticated" && (
            <div className="alert alert-warning text-center">
              Please sign in with Google to view and update your profile.
            </div>
          )}
          {isLoading && <div className="alert alert-secondary text-center">Loading profile…</div>}
          {error && <div className="alert alert-danger text-center">Failed to load profile.</div>}

          {data && (
            <form>
              {/* Personal */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 style={{ margin: 0, opacity: 0.9 }}>Personal</h6>
                  <span style={{ opacity: 0.6, fontSize: 12 }}>These help personalise your programme</span>
                </div>
                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label">Name</label>
                    <input type="text" className="form-control" name="name" value={formData.name ?? ""} onChange={handleTextChange} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">DOB</label>
                    <input
                      type="date"
                      className="form-control"
                      name="DOB"
                      value={toYMDOrEmpty(formData.DOB)}
                      onChange={handleTextChange}
                    />
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

              <hr style={{ borderColor: "rgba(255,255,255,0.12)" }} />

              {/* Metrics */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 style={{ margin: 0, opacity: 0.9 }}>Metrics</h6>
                  <span style={{ opacity: 0.6, fontSize: 12 }}>Used to calculate target calories</span>
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

              <hr style={{ borderColor: "rgba(255,255,255,0.12)" }} />

              {/* System fields (read-only) */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 style={{ margin: 0, opacity: 0.9 }}>System</h6>
                  <span style={{ opacity: 0.6, fontSize: 12 }}>Read‑only</span>
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
                  className="btn"
                  style={{
                    backgroundColor: "#ff7f32",
                    borderRadius: 24,
                    fontWeight: 700,
                    color: "#0b0f14",
                    border: "none",
                    boxShadow: "0 0 12px rgba(255,127,50,0.6)",
                  }}
                  onClick={handleUpdate}
                  disabled={saving || status !== "authenticated"}
                >
                  {saving ? "Updating..." : "Update Profile"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-light"
                  style={{ borderRadius: 24 }}
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
