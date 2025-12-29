
// pages/profile.tsx
import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useState, useEffect } from "react";
import BottomNav from "../components/BottomNav";

type Profile = {
  DOB: string;
  activity_factor: number | null;
  bodyfat_pct: number | null;
  caloric_target: number | null; // UI field (API aliases to calorie_target)
  created_at: string;
  email: string;
  height_cm: number | null;
  image: string;
  last_login_at: string;
  name: string;
  sex: string;
  weight_kg: number | null;
  location: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function toNumberOrNull(val: string): number | null {
  const trimmed = (val ?? "").trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? "";

  const { data, error, isLoading, mutate } = useSWR<Profile>(
    email ? `/api/profile?email=${encodeURIComponent(email)}` : null,
    fetcher
  );

  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({
        DOB: data.DOB ?? "",
        activity_factor: data.activity_factor ?? null,
        bodyfat_pct: data.bodyfat_pct ?? null,
        caloric_target: data.caloric_target ?? null, // keep UI field
        created_at: data.created_at ?? "",
        email: data.email ?? email,
        height_cm: data.height_cm ?? null,
        image: data.image ?? "",
        last_login_at: data.last_login_at ?? "",
        name: data.name ?? "",
        sex: data.sex ?? "",
        weight_kg: data.weight_kg ?? null,
        location: data.location ?? "",
      });
    }
  }, [data, email]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: toNumberOrNull(value) }));
  };

  // ✅ Auto-calculate caloric target when relevant fields change
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
  }, [
    formData.weight_kg,
    formData.height_cm,
    formData.DOB,
    formData.sex,
    formData.activity_factor,
  ]);

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
          DOB: formData.DOB ?? "",
          activity_factor: formData.activity_factor ?? null,
          bodyfat_pct: formData.bodyfat_pct ?? null,
          caloric_target: formData.caloric_target ?? null, // API accepts alias and maps to calorie_target
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
      setFormData(updated);
      mutate(); // refresh SWR cache/UI
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
      </Head>

      <main
        className="container d-flex justify-content-center align-items-center"
        style={{
          minHeight: "80vh",
          paddingBottom: "70px",
          background: "linear-gradient(135deg, #1a1a1a 0%, #2e1a0f 100%)",
          color: "#fff",
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "16px",
            padding: "24px",
            backdropFilter: "blur(10px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            width: "100%",
            maxWidth: "500px",
          }}
        >
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
            <p style={{ opacity: 0.7 }}>{email || "Not signed in"}</p>
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
              {/* Text fields */}
              {[
                { label: "Name", name: "name", type: "text" },
                { label: "Location", name: "location", type: "text" },
                { label: "Image URL", name: "image", type: "text", placeholder: "https://…" },
                { label: "DOB", name: "DOB", type: "text", placeholder: "e.g., 1990-05-04" },
                { label: "Sex", name: "sex", type: "text" },
              ].map((field) => (
                <div className="mb-3" key={field.name}>
                  <label className="form-label">{field.label}</label>
                  <input
                    type={field.type}
                    className="form-control"
                    name={field.name}
                    value={(formData as any)[field.name] ?? ""}
                    onChange={handleTextChange}
                    placeholder={field.placeholder || ""}
                  />
                </div>
              ))}

              {/* Number fields */}
              {[
                { label: "Height (cm)", name: "height_cm", step: "1" },
                { label: "Weight (kg)", name: "weight_kg", step: "0.1" },
                { label: "Body Fat (%)", name: "bodyfat_pct", step: "0.1" },
                { label: "Activity Factor", name: "activity_factor", step: "0.1" },
              ].map((field) => (
                <div className="mb-3" key={field.name}>
                  <label className="form-label">{field.label}</label>
                  <input
                    type="number"
                    step={field.step}
                    className="form-control"
                    name={field.name}
                    value={(formData as any)[field.name] ?? ""}
                    onChange={handleNumberChange}
                  />
                </div>
              ))}

              {/* Auto-calculated caloric target */}
              <div className="mb-3">
                <label className="form-label">Caloric Target (auto-calculated)</label>
                <input
                  type="number"
                  className="form-control"
                  name="caloric_target"
                  value={formData.caloric_target ?? ""}
                  readOnly
                />
              </div>

              {/* Update button */}
              <button
                type="button"
                className="btn w-100"
                style={{
                  backgroundColor: "#ff7f32",
                  borderRadius: "24px",
                  fontWeight: 600,
                  color: "#fff",
                  boxShadow: "0 0 12px rgba(255,127,50,0.8)",
                }}
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
