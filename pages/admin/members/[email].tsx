
// /pages/admin/members/[email].tsx
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";

const ACCENT = "#FF8A2A";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

type ProfileResp = {
  email: string;
  user?: any;
};

type FeedResp<T = any> = {
  items: { id: string; data: any }[];
  nextCursor?: string | null;
};

export default function AdminMemberDetail() {
  const mounted = useMounted();
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const isAllowed = !!session && (role === "admin" || role === "gym");

  const router = useRouter();
  const email = mounted && typeof router.query.email === "string" ? router.query.email : "";

  const [tab, setTab] = useState<"checkins" | "habits" | "nutrition" | "workouts">("checkins");
  const [cursors, setCursors] = useState<Record<string, string | null>>({
    checkins: null,
    habits: null,
    nutrition: null,
    workouts: null,
  });

  const profileKey =
    mounted && isAllowed && email ? `/api/admin/members/get?email=${encodeURIComponent(email)}` : null;
  const { data: profileData } = useSWR<ProfileResp>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const feeds = {
    checkins: mounted && isAllowed && email
      ? `/api/admin/members/checkins?email=${encodeURIComponent(email)}${cursors.checkins ? `&cursor=${encodeURIComponent(cursors.checkins!)}` : ""}`
      : null,
    habits: mounted && isAllowed && email
      ? `/api/admin/members/habits?email=${encodeURIComponent(email)}${cursors.habits ? `&cursor=${encodeURIComponent(cursors.habits!)}` : ""}`
      : null,
    nutrition: mounted && isAllowed && email
      ? `/api/admin/members/nutrition?email=${encodeURIComponent(email)}${cursors.nutrition ? `&cursor=${encodeURIComponent(cursors.nutrition!)}` : ""}`
      : null,
    workouts: mounted && isAllowed && email
      ? `/api/admin/members/workouts?email=${encodeURIComponent(email)}${cursors.workouts ? `&cursor=${encodeURIComponent(cursors.workouts!)}` : ""}`
      : null,
  };

  const { data: checkinsData, isValidating: loadingCheckins } = useSWR<FeedResp>(feeds.checkins, fetcher, { revalidateOnFocus: false });
  const { data: habitsData, isValidating: loadingHabits } = useSWR<FeedResp>(feeds.habits, fetcher, { revalidateOnFocus: false });
  const { data: nutritionData, isValidating: loadingNutrition } = useSWR<FeedResp>(feeds.nutrition, fetcher, { revalidateOnFocus: false });
  const { data: workoutsData, isValidating: loadingWorkouts } = useSWR<FeedResp>(feeds.workouts, fetcher, { revalidateOnFocus: false });

  const profile = profileData?.user || {};
  const titleName = profile?.display_name || profile?.name || profile?.profile?.name || email;

  const renderList = (items?: { id: string; data: any }[]) => {
    if (!items || items.length === 0) return <div className="text-center text-muted py-3">No entries.</div>;
    return (
      <div className="d-grid gap-2">
        {items.map((it) => {
          const d = it.data || {};
          const smallMeta = [
            d.week_friday_ymd || d.date || d.performed_at || d.logged_at,
            d.weight ? `Wt ${d.weight}` : null,
            d.calories ? `Cal ${d.calories}` : null,
            d.energy_levels ? `Energy ${d.energy_levels}` : null,
          ].filter(Boolean).join(" · ");

        return (
            <div
              key={it.id}
              className="p-3"
              style={{
                background: "rgba(255,255,255,0.06)",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="fw-semibold" style={{ color: "#fff" }}>
                {d.title || d.name || d.activity_type || d.type || it.id}
              </div>
              {smallMeta && <div className="small text-muted">{smallMeta}</div>}
              {/* Render a compact preview of key fields */}
              <div className="small mt-2">
                {Object.entries(d)
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <div key={k} className="text-muted">
                      <span style={{ color: "#8aa", marginRight: 6 }}>{k}:</span>
                      <span>{formatPreview(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const nextCursor = {
    checkins: checkinsData?.nextCursor || null,
    habits: habitsData?.nextCursor || null,
    nutrition: nutritionData?.nextCursor || null,
    workouts: workoutsData?.nextCursor || null,
  };

  const loadingForTab =
    tab === "checkins" ? loadingCheckins :
    tab === "habits" ? loadingHabits :
    tab === "nutrition" ? loadingNutrition :
    loadingWorkouts;

  const onLoadMore = () => {
    setCursors((c) => ({ ...c, [tab]: nextCursor[tab] || null }));
  };

  return (
    <>
      <Head>
        <title>{titleName} • Admin • BXKR</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <Link href="/admin/members" className="btn btn-outline-secondary">← Back</Link>
          <h2 className="mb-0">Member</h2>
          <div style={{ width: 80 }} />
        </div>

        {!mounted || status === "loading" ? (
          <div className="container py-4">Checking access…</div>
        ) : !isAllowed || !email ? (
          <div className="container py-4">
            <h3>Access Denied</h3>
            <p>You do not have permission to view this page.</p>
          </div>
        ) : (
          <>
            {/* Profile header */}
            <section
              className="p-3 mb-3"
              style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="fw-bold" style={{ fontSize: "1.25rem" }}>{titleName}</div>
              <div className="small text-muted">{email}</div>
              <div className="small mt-2">
                Membership: <span style={{ color: ACCENT }}>{profile?.membership_status || "—"}</span> · Sub:{" "}
                <span style={{ color: ACCENT }}>{profile?.subscription_status || "—"}</span>
              </div>
            </section>

            {/* Tabs */}
            <div className="d-flex gap-2 mb-2">
              {(["checkins", "habits", "nutrition", "workouts"] as const).map((t) => (
                <button
                  key={t}
                  className="btn"
                  onClick={() => setTab(t)}
                  style={{
                    borderRadius: 999,
                    padding: "6px 12px",
                    background: tab === t ? "rgba(255,138,42,0.2)" : "rgba(255,255,255,0.06)",
                    color: tab === t ? "#fff" : "#cbd5e1",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {t === "checkins" ? "Check-ins" : t === "habits" ? "Daily Habits" : t === "nutrition" ? "Nutrition" : "Workouts"}
                </button>
              ))}
            </div>

            {/* Feed */}
            <section className="mb-3">
              {tab === "checkins" && renderList(checkinsData?.items)}
              {tab === "habits" && renderList(habitsData?.items)}
              {tab === "nutrition" && renderList(nutritionData?.items)}
              {tab === "workouts" && renderList(workoutsData?.items)}
            </section>

            {/* Load more */}
            <div className="d-grid">
              {nextCursor[tab] ? (
                <button className="bxkr-btn" onClick={onLoadMore} disabled={loadingForTab}>
                  {loadingForTab ? "Loading…" : "Load more"}
                </button>
              ) : (
                <button className="btn btn-outline-secondary" disabled>
                  End of list
                </button>
              )}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function formatPreview(v: any): string {
  if (v == null) return "—";
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 120) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v?.toDate === "function") return v.toDate().toISOString();
  if (v?.seconds && v?.nanoseconds) {
    return new Date(v.seconds * 1000).toISOString();
  }
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === "object") return "{…}";
  return String(v);
}
