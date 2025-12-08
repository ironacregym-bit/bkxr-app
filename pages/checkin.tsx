
// /pages/checkin.tsx
import Head from "next/head";
import { useSession } from "next-auth/react";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";
import BxkrBanner from "../components/BxkrBanner";

export const getServerSideProps: GetServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getSession(context);
  if (!session) {
    return { redirect: { destination: "/landing", permanent: false } };
  }
  return { props: {} };
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// Helpers aligned with index.tsx
function formatYMD(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n.toISOString().slice(0, 10);
}
function startOfAlignedWeek(d: Date) {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}
function fridayOfWeek(d: Date): Date {
  const s = startOfAlignedWeek(d);
  const f = new Date(s);
  f.setDate(s.getDate() + 4);
  f.setHours(0, 0, 0, 0);
  return f;
}

export default function CheckInPage() {
  const { data: session } = useSession();
  const today = new Date();
  const thisFriday = useMemo(() => fridayOfWeek(today), [today]);
  const thisFridayYMD = formatYMD(thisFriday);

  const { data, mutate } = useSWR(
    `/api/checkins/weekly?week=${encodeURIComponent(formatYMD(today))}`,
    fetcher
  );
  const alreadySubmitted = !!data?.entry;

  const [notes, setNotes] = useState("");

  async function submitCheckIn(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/checkins/weekly?week=${encodeURIComponent(formatYMD(today))}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || "Failed to submit check-in");
        return;
      }
      mutate(); // refresh SWR cache
      setNotes("");
    } catch (err) {
      alert("Network error submitting check-in");
    }
  }

  return (
    <>
      <Head>
        <title>Weekly Check‑in • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`
          .glass-card {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.35);
            backdrop-filter: blur(10px);
          }
          .bxkr-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 18px;
            border-radius: 999px;
            border: none;
            color: #fff;
            background: linear-gradient(135deg, #ff7a00, #ff9a3a);
            box-shadow: 0 0 12px rgba(255,122,0,0.6);
            transition: box-shadow .2s ease, transform .2s ease;
          }
          .bxkr-btn:hover {
            box-shadow: 0 0 18px rgba(255,122,0,0.9);
            transform: translateY(-1px);
          }
        `}</style>
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          background: "linear-gradient(135deg,#101317,#1f1a14)",
          color: "#fff",
          borderRadius: 12,
        }}
      >
        {/* Header */}
        <div className="d-flex justify-content-between mb-3 align-items-center">
          <div className="d-flex align-items-center gap-2">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="rounded-circle"
                style={{ width: 36, height: 36, objectFit: "cover" }}
              />
            )}
            <div className="fw-semibold">{session?.user?.name || "Athlete"}</div>
          </div>
          <div className="text-end small" style={{ opacity: 0.85 }}>
            Week’s Friday: <strong>{thisFridayYMD}</strong>
          </div>
        </div>

        <h2 className="mb-3" style={{ fontWeight: 700, fontSize: "1.6rem" }}>
          Weekly Check‑in
        </h2>

        {/* Status Banner */}
        {alreadySubmitted ? (
          <BxkrBanner
            title="All set"
            message="Your weekly check‑in is already submitted for this week."
            href="/"
            iconLeft="fas fa-clipboard-check"
            accentColor="#64c37a"
            buttonText="Back to Home"
          />
        ) : (
          <BxkrBanner
            title="Check‑in due"
            message="Submit your weekly check‑in for this week."
            href="#checkin-form"
            iconLeft="fas fa-clipboard-list"
            accentColor="#c9a34e"
            buttonText="Jump to Form"
          />
        )}

        {/* Form Card */}
        {!alreadySubmitted && (
          <div id="checkin-form" className="glass-card p-3 mt-3">
            <form onSubmit={submitCheckIn}>
              <div className="mb-3">
                <label className="form-label">Notes (optional)</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How did your week go? Anything notable?"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                />
              </div>

              <button type="submit" className="bxkr-btn">
                <i className="fas fa-check me-2" />
                Submit Check‑in
              </button>
            </form>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
