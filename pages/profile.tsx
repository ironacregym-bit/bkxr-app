import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function Profile() {
  const { data: session, status } = useSession();
  const email = session?.user?.email;

  const { data, error, isLoading } = useSWR(
    email ? `/api/profile?email=${encodeURIComponent(email)}` : null,
    fetcher
  );

  return (
    <>
      <Head>
        <title>Profile | BXKR </title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>

      <main className="container py-4" style={{ paddingBottom: "70px" }}>
        <h2 className="text-center mb-4">Your Profile</h2>

        {status === "loading" && <p>Loading session...</p>}
        {!session && <p>Please sign in to view your profile.</p>}

        {isLoading && <div className="alert alert-secondary">Loading profile...</div>}
        {error && <div className="alert alert-danger">Failed to load profile.</div>}

        {data && (
          <div className="card shadow-sm p-3">
            <div className="text-center mb-3">
              <img
                src={data.Image || session?.user?.image || "/default-avatar.png"}
                alt="Profile"
                style={{ width: 100, height: 100, borderRadius: "50%" }}
              />
              <h4 className="mt-2">{data.Name || session?.user?.name}</h4>
              <p className="text-muted">{email}</p>
            </div>

            <ul className="list-group list-group-flush">
              <li className="list-group-item"><strong>DOB:</strong> {data.DOB || "Not set"}</li>
              <li className="list-group-item"><strong>Sex:</strong> {data.Sex || "Not set"}</li>
              <li className="list-group-item"><strong>Height:</strong> {data.Height_cm} cm</li>
              <li className="list-group-item"><strong>Weight:</strong> {data.Weight_kg} kg</li>
              <li className="list-group-item"><strong>Body Fat:</strong> {data.Bodyfat_pct}%</li>
              <li className="list-group-item"><strong>Activity Factor:</strong> {data.Activity_Factor}</li>
              <li className="list-group-item"><strong>Calorie Target:</strong> {data.Calorie_target}</li>
              <li className="list-group-item"><strong>Last Login:</strong> {data.Last_login_at}</li>
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
