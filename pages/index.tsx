import useSWR from "swr";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function Home() {
  // Session
  const { data: session, status } = useSession(); // status: 'loading' | 'authenticated' | 'unauthenticated'

  // Data
  const { data, error, isLoading } = useSWR("/api/workouts", fetcher);

  return (
    <main style={{ padding: 16 }}>
      <h1>BXKR</h1>

      {/* Auth bar */}
      <div style={{ marginBottom: 12 }}>
        {status === "loading" ? (
          <span>Checking session…</span>
        ) : !session ? (
          <button onClick={() => signIn("google")}>Sign in with Google</button>
        ) : (
          <button onClick={() => signOut()}>
            Sign out ({session.user?.email})
          </button>
        )}
      </div>

      {/* Content */}
      {error && <div style={{ color: "crimson" }}>Failed to load workouts</div>}
      {isLoading && <div>Loading…</div>}

      {!isLoading && data?.workouts?.map((w: any) => (
        <div key={w.id} style={{ margin: "8px 0", padding: 12, border: "1px solid #222", borderRadius: 8 }}>
          <div><b>{w.day}</b> — {w.title}</div>
          <Link href={`/workout/${w.id}`}>Open</Link>
        </div>
      ))}

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <a
          href={`https://wa.me/${process.env.NEXT_PUBLIC_TRAINER_PHONE || process.env.TRAINER_PHONE}?text=Hi%20Coach%20I%27m%20doing%20BXKR`}
          target="_blank"
          rel="noreferrer"
        >
          Speak to trainer
        </a>
      </div>
    </main>
  );
}
