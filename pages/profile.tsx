
import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useState, useEffect } from "react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";

type Profile = {
  DOB: string;
  activity_factor: number | null;
  bodyfat_pct: number | null;
  caloric_target: number | null;
  created_at: string;       // ISO or ""
  email: string;
  height_cm: number | null;
  image: string;
  last_login_at: string;    // ISO or ""
  name: string;
  sex: string;
  weight_kg: number | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Helper to coerce numeric text inputs to number or null
function toNumberOrNull(val: string): number | null {
  const trimmed = (val ?? "").trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export default function Profile() {
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? "";

  const { data, error, isLoading, mutate } = useSWR<Profile>(
    email ? `/api/profile?email=${encodeURIComponent(email)}` : null,
    fetcher
  );

  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);

  // Populate local form state when data loads
  useEffect(() => {
    if (data) {
      setFormData({
        DOB: data.DOB ?? "",
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
      });
    }
  }, [data, email]);

  // Text field handler (string values)
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Number field handler
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: toNumberOrNull(value) }));
  };

  const handleUpdate = async () => {
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
          // Only send allowed fields
          DOB: formData.DOB ?? "",
          activity_factor: formData.activity_factor ?? null,
          bodyfat_pct: formData.bodyfat_pct ?? null,
          caloric_target: formData.caloric_target ?? null,
          // created_at & last_login_at typically managed server-side;
          // if you want to allow client-side editing, include them.
          // Here we pass through existing values (no client edit).
          created_at: formData.created_at ?? "",
          email, // ensure consistency with doc ID
          height_cm: formData.height_cm ?? null,
          image: formData.image ?? "",
          last_login_at: formData.last_login_at ?? "",
          name: formData.name ?? "",
          sex: formData.sex ?? "",
          weight_kg: formData.weight_kg ?? null,
        }),
      });

      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem?.error ?? "Update failed");
      }

      const updated: Profile = await res.json();
      setFormData(updated);
      mutate(); // refresh cache
      alert("✅ Profile updated successfully!");
    } catch (err: any) {
      console.error("Profile update error:", err?.message || err);
      alert("❌ Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
      </Head>

      <main
        className="container d-flex justify-content-center align-items-center"
        style={{ minHeight: "80vh", paddingBottom: "70px" }}
      >
        <div className="card shadow-lg p-4 w-100" style={{ maxWidth: "500px" }}>
          <div className="text-center mb-4">
            <img
              src={
                (formData.image && formData.image !== "" ? formData.image : undefined) ||
                session?.user?.image ||
                "/default-avatar.png"
              }
              alt="Profile"
              className="rounded-circle border"
              style={{ width: 100, height: 100, objectFit: "cover" }}
            />
            <h4 className="mt-3">{formData.name || session?.user?.name || "Your Name"}</h4>
            <p className="text-muted">{email || "Not signed in"}</p>
          </div>

          {status === "loading" && (
            <div className="alert alert-secondary text-center">Loading session…</div>
          )}

          {status === "unauthenticated" && (
            <div className="alert alert-warning text-center">
              Please sign in with Google to view and update your profile.
            </div>
          )}

          {isLoading && (
            <div className="alert alert-secondary text-center">Loading profile…</div>
          )}
          {error && (
            <div className="alert alert-danger text-center">Failed to load profile.</div>
          )}

          {data && (
            <form>
              {/* Basic Info */}
              <div className="mb-3">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  name="name"
                  value={formData.name ?? ""}
                  onChange={handleTextChange}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Image URL</label>
                <input
                  type="text"
                  className="form-control"
                  name="image"
                  value={formData.image ?? ""}
                  onChange={handleTextChange}
                  placeholder="https://…"
                />
              </div>

              {/* Schema fields */}
              <div className="mb-3">
                <label className="form-label">DOB</label>
                <input
                  type="text"
                  className="form-control"
                  name="DOB"
                  value={formData.DOB ?? ""}
                  onChange={handleTextChange}
                  placeholder="e.g., 1990-05-04 or 04/05/1990"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Sex</label>
                <input
                  type="text"
                  className="form-control"
                  name="sex"
                  value={formData.sex ?? ""}
                  onChange={handleTextChange}
                  placeholder="e.g., Male / Female / Prefer not to say"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Height (cm)</label>
                <input
                  type="number"
                  step="1"
                  className="form-control"
                  name="height_cm"
                  value={formData.height_cm ?? ""}
                  onChange={handleNumberChange}
                  placeholder="e.g., 178"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  name="weight_kg"
                  value={formData.weight_kg ?? ""}
                  onChange={handleNumberChange}
                  placeholder="e.g., 82.5"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Body Fat (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  name="bodyfat_pct"
                  value={formData.bodyfat_pct ?? ""}
                  onChange={handleNumberChange}
                  placeholder="e.g., 15.8"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Activity Factor</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  name="activity_factor"
                  value={formData.activity_factor ?? ""}
                  onChange={handleNumberChange}
                  placeholder="e.g., 1.2, 1.4, 1.6"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Caloric Target</label>
                <input
                  type="number"
                  step="1"
                  className="form-control"
                  name="caloric_target"
                  value={formData.caloric_target ?? ""}
                  onChange={handleNumberChange}
                  placeholder="e.g., 2200"
                />
              </div>

              {/* Read-only meta (from Firestore; normalised to strings by API) */}
              <div className="mb-3">
                <label className="form-label">Created At</label>
                <input
                  type="text"
                  className="form-control"
                  name="created_at"
                  value={formData.created_at ?? ""}
                  onChange={handleTextChange}
                  disabled
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Last Login At</label>
                <input
                  type="text"
                  className="form-control"
                  name="last_login_at"
                  value={formData.last_login_at ?? ""}
                  onChange={handleTextChange}
                  disabled
                />
              </div>

              <button
                type="button"
                className="btn btn-primary w-100"
                onClick={handleUpdate}
                disabled={saving || status !== "authenticated"}
              >
                {saving ? "Updating..." : "Update Profile"}
              </button>
            </form>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
