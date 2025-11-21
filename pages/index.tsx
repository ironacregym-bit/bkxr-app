import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const fetcher = (u: string) => fetch(u).then(r => r.json());

function getWeek() {
  const today = new Date();
  const day = today.getDay();
  const diffToMon = ((day + 6) % 7);
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

export default function Home() {
  const { data: session, status } = useSession();
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      fetch("/api/users/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.user.email,
          name: session.user.name || "",
          image: session.user.image || ""
        })
      }).catch(() => {});
    }
  }, [status, session?.user?.email]);

  const weekDays = getWeek();

  return (
    <>
      <Head>
        <title>BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"/>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
      </Head>

      <main className="container py-3" style={{ paddingBottom: "70px" }}>
        <h1 className="mb-4 text-center">BXKR</h1>

        {/* Auth bar */}
        <div className="mb-4 d-flex justify-content-center gap-3 flex-wrap">
          {status === "loading" ? (
            <span>Checking session…</span>
          ) : !session ? (
            <button className="btn btn-dark" onClick={() => signIn("google")}>
              Sign in with Google
            </button>
          ) : (
            <div className="d-flex gap-3 align-items-center">
              <img
                src={session.user?.image ?? ""}
                alt=""
                style={{ width: 32, height: 32, borderRadius: "50%" }}
              />
              <span className="text-muted">{session.user?.email}</span>
              <button className="btn btn-outline-dark" onClick={() => signOut()}>
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Errors/Loading */}
        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}

        {/* Weekly calendar row */}
        <div className="d-flex justify-content-between text-center mb-4 flex-wrap">
          {weekDays.map((d, i) => {
            const dayName = d.toLocaleDateString(undefined, { weekday: "long" });
            const workoutsForDay = (data?.workouts || []).filter(
              (w: any) => (w.day || "").toLowerCase() === dayName.toLowerCase()
            );
            return (
              <div key={i} style={{ width: "14%" }}>
                <div className="fw-bold">{dayLabels[i]}</div>
                {workoutsForDay.length > 0 && (
                  <div className="mt-2">
                    {workoutsForDay.map((w: any) => (
                      <Link key={w.id} href={`/workout/${w.id}`}>
                        <i className="fas fa-dumbbell fa-2x text-primary" title={w.title}></i>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
