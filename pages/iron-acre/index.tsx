import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import BottomNav from "../../components/BottomNav";
import IronAcreHeader from "../../components/iron-acre/IronAcreHeader";
import IronAcreTasks from "../../components/iron-acre/IronAcreTasks";
import IronAcreStrengthSummary from "../../components/iron-acre/IronAcreStrengthSummary";
import IronAcreRecentSessions from "../../components/iron-acre/IronAcreRecentSessions";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function IronAcreHome() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const userName = (session?.user?.name || session?.user?.email || "Athlete").toString();

  const dateLabel = useMemo(() => {
    const d = new Date();
    try {
      return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    } catch {
      return d.toDateString();
    }
  }, []);

  const { data: strengthProfile } = useSWR(mounted ? "/api/strength/profile/get" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  if (!mounted) return null;

  if (status === "loading") {
    return (
      <main className="container py-4" style={{ color: "#fff" }}>
        Loading…
      </main>
    );
  }

  if (!session) {
    const cb = encodeURIComponent("/iron-acre");
    return (
      <>
        <Head>
          <title>Iron Acre Gym</title>
        </Head>
        <main className="container py-4" style={{ color: "#fff", paddingBottom: 90 }}>
          <section className="futuristic-card p-3">
            <h2 className="m-0">Iron Acre Gym</h2>
            <div className="text-dim mt-2">Please sign in to view your performance dashboard.</div>
            <div className="mt-3">
              <Link href={`/register?callbackUrl=${cb}`} className="btn btn-outline-light" style={{ borderRadius: 24 }}>
                Sign in
              </Link>
            </div>
          </section>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <IronAcreHeader userName={userName} dateLabel={dateLabel} />

        <IronAcreTasks />

        <div className="row g-2">
          <div className="col-12 col-lg-6">
            <IronAcreStrengthSummary profile={strengthProfile?.profile} />
          </div>
          <div className="col-12 col-lg-6">
            <IronAcreRecentSessions />
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
