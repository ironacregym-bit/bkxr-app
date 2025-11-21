import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useState, useEffect } from "react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Profile() {
  const { data: session, status } = useSession();
  const email = session?.user?.email;

  const { data, error, isLoading, mutate } = useSWR(
    email ? `/api/profile?email=${encodeURIComponent(email)}` : null,
    fetcher
  );

  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Populate formData when data loads
  useEffect(() => {
    if (data) setFormData(data);
  }, [data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    setSaving(true);
    const res = await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...formData }),
    });
    setSaving(false);
    if (res.ok) {
      alert("✅ Profile updated successfully!");
      mutate(); // Refresh SWR cache
    } else {
      alert("❌ Failed to update profile.");
    }
  };

  return (
    <>
      <Head>
        <title>Profile | BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet"href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"/>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
      </Head>
      <main className="container d-flex justify-content-center align-items-center" style={{ minHeight: "80vh", paddingBottom: "70px" }}>
        <div className="card shadow-lg p-4 w-100" style={{ maxWidth: "500px" }}>
          <div className="text-center mb-4">
            <img
              src={formData.Image || session?.user?.image || "/default-avatar.png"}
              alt="Profile"
              className="rounded-circle border"
              style={{ width: 100, height: 100, objectFit: "cover" }}
            />
            <h4 className="mt-3">{formData.Name || session?.user?.name}</h4>
            <p className="text-muted">{email}</p>
          </div>

          {isLoading && (
            <div className="alert alert-secondary text-center">Loading profile...</div>
          )}
          {error && (
            <div className="alert alert-danger text-center">Failed to load profile.</div>
          )}

          {data && (
            <form>
              {[
                "DOB",
                "Sex",
                "Height_cm",
                "Weight_kg",
                "Bodyfat_pct",
                "Activity_Factor",
                "Calorie_target",
              ].map((field) => (
                <div className="mb-3" key={field}>
                  <label className="form-label">{field.replace("_", " ")}</label>
                  <input
                    type="text"
                    className="form-control"
                    name={field}
                    value={formData[field] || ""}
                    onChange={handleChange}
                  />
                </div>
              ))}
              <button
                type="button"
                className="btn btn-primary w-100"
                onClick={handleUpdate}
                disabled={saving}
              >
                {saving ? "Updating..." : "Update Profile"}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="navbar fixed-bottom bg-light border-top">
        <div className="container d-flex justify-content-around">
          <Link href="/">
            <i className="fas fa-home fa-lg"></i>
            <div style={{ fontSize: "12px" }}>Home</div>
          </Link>
          <Link href="/workout/today">
            <i className="fas fa-dumbbell fa-lg"></i>
            <div style={{ fontSize: "12px" }}>WoD</div>
          </Link>
          <Link href="/profile">
            <i className="fas fa-user fa-lg"></i>
            <div style={{ fontSize: "12px" }}>Profile</div>
          </Link>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_TRAINER_PHONE || process.env.TRAINER_PHONE}?text=Hi%20Coach%20I%27m%20doing%20BXKR`}
            target="_blank"
            rel="noreferrer"
            className="text-center text-dark"
          >
            <i className="fas fa-comments fa-lg"></i>
            <div style={{ fontSize: "12px" }}>Chat</div>
          </a>
        </div>
      </nav>
    </>
  );
}
