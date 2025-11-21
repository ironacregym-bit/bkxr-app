import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function Profile() {
  const { data: session, status } = useSession();
  const email = session?.user?.email;

  const { data, error, isLoading } = useSWR(
    email ? `/api/profile?email=${encodeURIComponent(email)}` : null,
    fetcher
  );

  const [formData, setFormData] = useState<any>({});

  // Populate form when data loads
  if (data && Object.keys(formData).length === 0) {
    setFormData(data);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    const res = await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...formData }),
    });
    if (res.ok) alert("Profile updated successfully!");
    else alert("Failed to update profile.");
  };

  return (
    <>
      <Head>
        <title>Profile | BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"/>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
      </Head>

      <main className="container d-flex justify-content-center align-items-center" style={{ minHeight: "80vh", paddingBottom: "70px" }}>
        <div className="card shadow-lg p-4" style={{ maxWidth: "500px", width: "100%" }}>
          <div className="text-center mb-3">
            <img
              src={formData.Image || session?.user?.image || "/default-avatar.png"}
              alt="Profile"
              style={{ width: 100, height: 100, borderRadius: "50%" }}
            />
            <h4 className="mt-2">{formData.Name || session?.user?.name}</h4>
            <p className="text-muted">{email}</p>
          </div>

          {isLoading && <div className="alert alert-secondary">Loading profile...</div>}
          {error && <div className="alert alert-danger">Failed to load profile.</div>}

          {data && (
            <form>
              {["DOB", "Sex", "Height_cm", "Weight_kg", "Bodyfat_pct", "Activity_Factor", "Calorie_target"].map((field) => (
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
              <button type="button" className="btn btn-primary w-100" onClick={handleUpdate}>
                Update Profile
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
