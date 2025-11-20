import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const fetcher = (u: string) => fetch(u).then(r => r.json());

// Helpers: build Mon–Sun for current week
function getWeek(startMonday = true) {
  const today = new Date();
  const day = today.getDay(); // 0=Sun..6=Sat
  const diffToMon = ((day + 6) % 7); // Mon=0..Sun=6
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMon);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  return days;
}

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function Home() {
  const { data: session, status } = useSession(); // 'loading' | 'authenticated' | 'unauthenticated'
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  // Upsert the user into Sheets once authenticated
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
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
          integrity="sha384-GtvQFJr7WqF6v1m6D8r1qI6S1lqJcMZpQ8fKQbTqYIhBfQn6kQqH3fWcH2lZs8"
          crossap-2 align-items-center">
          {status === "loading" ? (
            <span>Checking session…</span>
          ) : !session ? (
            <button className="btn btn-dark" onClick={() => signIn("google")}>
              Sign in with Google
            </button>
          ) : (
            <>
              <img
                src={session.user?.image ?? ""}
                alt=""
                style={{ width: 28, height: 28, borderRadius: "50%" }}
              />
              <span className="text-muted">{session.user?.email}</span>
              <button
                className="btn btn-outline-dark ms-auto"
                onClick={() => signOut()}
              >
                Sign out
              </button>
            </>
          )}
        </div>

        {/* Errors/Loading */}
        {error && <div className="alert alert-danger">Failed to load workouts</div>}
        {isLoading && <div className="alert alert-secondary">Loading…</div>}

        {/* Weekly calendar: 3 workouts per week target */}
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
          {weekDays.map((d, i) => {
            const dayName = d.toLocaleDateString(undefined, { weekday: "long" }); // "Monday"
            const workoutsForDay = (data?.workouts || []).filter(
              (w: any) => (w.day || "").toLowerCase() === dayName.toLowerCase()
            );
            return (
              <div className="col" key={i}>
                <div className="card h-100 border-dark">
                  <div className="card-header fw-bold">{fmt(d)}</div>
                  <div className="card-body">
                    {workoutsForDay.length === 0 ? (
                      <p className="text-muted mb-0">No workout planned</p>
                    ) : (
                      workoutsForDay.map((w: any) => (
                        <div className="mb-2" key={w.id}>
                          <div className="d-flex align-items-center justify-content-between">
                            <div>
                              <div className="fw-semibold">{w.title}</div>
                              <small className="text-muted">
                                {w.exercises?.length ?? 0} exercises
                              </small>
                            </div>
                            <Link
                              className="btn btn-sm btn-outline-dark"
                              href={`/workout/${w.id}`}
                            >
                              Open
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="card-footer">
                    <small className="text-muted">Target: 3 workouts this week</small>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Speak to trainer */}
        <div className="mt-3">
          <a
            className="btn btn-success"
            href={`https://wa.me/${process.env.NEXT_PUBLIC_TRAINER_PHONE || process.env.TRAINER_PHONE}?text=Hi%20Coach%20I%27m%20doing%20BXKR`}
            target="_blank"
            rel="noreferrer"
          >
            Speak to trainer
          </a>
        </div>
      </main>
    </>
  );
}
