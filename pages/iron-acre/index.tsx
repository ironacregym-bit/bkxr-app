// File: pages/iron-acre/index.tsx
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

function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}
function startOfAlignedWeek(d: Date) {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}

export default function IronAcreHome() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const userName = (session?.user?.name || session?.user?.email || "Athlete").toString();

  const now = useMemo(() => new Date(), []);
  const dateLabel = useMemo(() => {
    try {
      return now.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {
      return now.toDateString();
    }
  }, [now]);

  const weekStartKey = useMemo(
    () => (mounted ? formatYMD(startOfAlignedWeek(new Date())) : ""),
    [mounted]
  );

  const { data: weeklyOverview } = useSWR(
    mounted && weekStartKey
      ? `/api/weekly/overview?week=${encodeURIComponent(weekStartKey)}`
      : null,
    fetcher
  );

  const { data: strengthProfile } = useSWR(
    mounted ? "/api/strength/profile/get" : null,
    fetcher
  );

  if (!mounted) return null;

  if (status === "loading") {
    return <main className="container py-4">Loading…</main>;
  }

  if (!session) {
    const cb = encodeURIComponent("/iron-acre");
    return (
      <>
        <Head>
          <title>Iron Acre Gym</title>
        </Head>

        <main className="container py-4" style={{ paddingBottom: 90 }}>
          <section className="futuristic-card p-3">
            <h2>Iron Acre Gym</h2>
            <div>Please sign in to view your dashboard.</div>
            <div className="mt-3">
              <Link href={`/register?callbackUrl=${cb}`} className="btn btn-outline-light">
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
      </Head>

      <main className="container py-3" style={{ paddingBottom: 90 }}>
        <IronAcreHeader userName={userName} dateLabel={dateLabel} />

        {/* FOUNDING MEMBERS */}
        <section className="futuristic-card p-3 mb-3">
          <div className="fw-bold">Founding Members</div>
          <div className="mt-2 text-dim small">Join from day one.</div>

          <div className="mt-3" style={{ display: "grid", gap: 6 }}>
            <div>✅ £60/month for life</div>
            <div>✅ Priority class access</div>
            <div>✅ Early access</div>
            <div>✅ Opening BBQ</div>
            <div>✅ Founder status</div>
          </div>

          <div className="mt-3 fw-bold">Limited spots</div>
        </section>

        {/* CLASSES */}
        <section className="futuristic-card p-3 mb-3">
          <div className="fw-bold">Classes</div>

          <div className="mt-2" style={{ display: "grid", gap: 10 }}>
            <div>
              <div className="fw-semibold">Hybrid Fit</div>
              <div className="text-dim small">
                Strength and conditioning combined.
              </div>
            </div>

            <div>
              <div className="fw-semibold">Farm Strength</div>
              <div className="text-dim small">
                Functional strength using real-world movements.
              </div>
            </div>

            <div>
              <div className="fw-semibold">Boxing Conditioning</div>
              <div className="text-dim small">
                Fast sessions focused on power and fitness.
              </div>
            </div>

            <div>
              <div className="fw-semibold">Kettlebells</div>
              <div className="text-dim small">
                Build strength and endurance simply and effectively.
              </div>
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="futuristic-card p-3 mb-3">
          <div className="fw-bold">Benefits</div>

          <div className="mt-2" style={{ display: "grid", gap: 6 }}>
            <div>✅ Coach-led sessions</div>
            <div>✅ Open gym access</div>
            <div>✅ Structured training program</div>
            <div>✅ App tracking</div>
            <div>✅ Online coaching support</div>
          </div>
        </section>

        {/* ABOUT */}
        <section className="futuristic-card p-3 mb-3">
          <div className="fw-bold">About Iron Acre</div>

          <div className="mt-2 text-dim small">
            This is not another outdoor bootcamp.
            <br />
            <br />
            We focus on proper progression, structured training and real coaching.
            <br />
            <br />
            No guesswork. No random workouts. Just real results.
          </div>
        </section>

        {/* WHAT’S NEXT */}
        <section className="futuristic-card p-3 mb-3">
          <div className="fw-bold">What’s Next</div>

          <div className="mt-2 text-dim small">
            This is just the start.
          </div>

          <div className="mt-3" style={{ display: "grid", gap: 6 }}>
            <div>🔥 Cold water therapy</div>
            <div>🔥 Wild saunas</div>
            <div>🔥 Hot tubs</div>
            <div>🔥 Expanded gym area</div>
          </div>
        </section>

        {/* EXISTING SYSTEM */}
        <IronAcreTasks
          todayData={weeklyOverview?.days?.[0]}
          weekDays={weeklyOverview?.days || []}
          weekStartYMD={weeklyOverview?.weekStartYMD || ""}
          weekEndYMD={weeklyOverview?.weekEndYMD || ""}
        />

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
