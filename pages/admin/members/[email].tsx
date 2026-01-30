import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useRef } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";
import type { GetServerSideProps } from "next";

// Charts (client)
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

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

type CheckinRow = {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  photo_url?: string | null;
};
type CheckinsSeriesResp = { results: CheckinRow[] };

// ---- Utils for Chart series
function toISO(v: any) {
  try {
    const d = v?.toDate?.() instanceof Date ? v.toDate() : v ? new Date(v) : null;
    return d && !isNaN(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
}
const fmtChartLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

// Image -> dataURL (downscale)
async function imageFileToDataUrl(file: File, maxSize = 1400, quality = 0.82): Promise<string> {
  const img = document.createElement("img");
  const reader = new FileReader();
  const loadPromise = new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      if (!reader.result) return reject(new Error("Failed to read image"));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const { width, height } = img;
          const scale = Math.min(1, maxSize / Math.max(width, height));
          const w = Math.max(1, Math.round(width * scale));
          const h = Math.max(1, Math.round(height * scale));
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("No 2D context"));
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
  });
  reader.readAsDataURL(file);
  return loadPromise;
}

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
  const { data: profileData, mutate: mutateProfile } = useSWR<ProfileResp>(profileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const feeds = {
    checkins:
      mounted && isAllowed && email
        ? `/api/admin/members/checkins?email=${encodeURIComponent(email)}${
            cursors.checkins ? `&cursor=${encodeURIComponent(cursors.checkins)}` : ""
          }`
        : null,
    habits:
      mounted && isAllowed && email
        ? `/api/admin/members/habits?email=${encodeURIComponent(email)}${
            cursors.habits ? `&cursor=${encodeURIComponent(cursors.habits)}` : ""
          }`
        : null,
    nutrition:
      mounted && isAllowed && email
        ? `/api/admin/members/nutrition?email=${encodeURIComponent(email)}${
            cursors.nutrition ? `&cursor=${encodeURIComponent(cursors.nutrition)}` : ""
          }`
        : null,
    workouts:
      mounted && isAllowed && email
        ? `/api/admin/members/workouts?email=${encodeURIComponent(email)}${
            cursors.workouts ? `&cursor=${encodeURIComponent(cursors.workouts)}` : ""
          }`
        : null,
  };

  const { data: checkinsData, isValidating: loadingCheckins, mutate: mutateCheckins } = useSWR<FeedResp>(
    feeds.checkins,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: habitsData, isValidating: loadingHabits } = useSWR<FeedResp>(
    feeds.habits,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: nutritionData, isValidating: loadingNutrition } = useSWR<FeedResp>(
    feeds.nutrition,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: workoutsData, isValidating: loadingWorkouts } = useSWR<FeedResp>(
    feeds.workouts,
    fetcher,
    { revalidateOnFocus: false }
  );

  // ---- Series for charts (same as user Progress, but for this member)
  const seriesKey =
    mounted && isAllowed && email
      ? `/api/checkins/series?email=${encodeURIComponent(email)}&limit=1000`
      : null;
  const { data: checkinsSeries } = useSWR<CheckinsSeriesResp>(seriesKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });

  const profile = profileData?.user || {};
  const titleName = profile?.display_name || profile?.name || profile?.profile?.name || email || "Member";

  // === Check-ins renderer (rich with photos) ===
  const renderCheckins = (items?: { id: string; data: any }[]) => {
    if (!items || items.length === 0) {
      return <div className="text-center text-muted py-3">No entries.</div>;
    }

    return (
      <div className="d-grid gap-3">
        {items.map((it) => {
          const d = it.data || {};
          const week = d.week_friday_ymd;
          const updated = d.updated_at;
          const weight = d.weight;
          const stress = d.stress_levels;
          const goalsAchieved =
            typeof d.weekly_goals_achieved === "boolean"
              ? d.weekly_goals_achieved
                ? "Yes"
                : "No"
              : "—";
          const notes = d.notes || "";
          const nextGoals = d.next_week_goals || "";
          const photos = {
            front: d.progress_photo_front,
            side: d.progress_photos_side, // keep existing display key
            back: d.progress_photos_back, // keep existing display key
          };

          return (
            <CheckinCard
              key={it.id}
              week={week}
              updated={updated}
              weight={weight}
              stress={stress}
              goalsAchieved={goalsAchieved}
              notes={notes}
              nextGoals={nextGoals}
              photos={photos}
            />
          );
        })}
      </div>
    );
  };

  // === Nutrition totals renderer (per day) ===
  const renderNutrition = (items?: { id: string; data: any }[]) => {
    if (!items || items.length === 0) {
      return <div className="text-center text-muted py-3">No entries.</div>;
    }

    return (
      <div className="d-grid gap-2">
        {items.map((it) => {
          const d = it.data || {};
          const date = d.date || it.id;
          const totalProtein = d.total_protein ?? 0;
          const totalGrams = d.total_grams ?? 0;
          const itemsCount = d.items_count ?? 0;
          const perMeal = d.per_meal || {};

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
              <div className="d-flex align-items-center justify-content-between">
                <div className="fw-semibold" style={{ color: "#fff" }}>
                  {date}
                </div>
                <div className="small text-muted">{itemsCount} items</div>
              </div>

              <div className="row g-2 mt-2">
                <div className="col-6 col-md-3">
                  <div className="small text-muted">Protein (g)</div>
                  <div className="fw-semibold">{totalProtein}</div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="small text-muted">Total grams</div>
                  <div className="fw-semibold">{totalGrams}</div>
                </div>
              </div>

              {perMeal && (
                <div className="mt-2">
                  <div className="small text-muted mb-1">Per meal</div>
                  <div className="small">
                    {Object.keys(perMeal).length === 0 && <span className="text-muted">—</span>}
                    {Object.entries(perMeal).map(([meal, m]: any) => (
                      <div key={meal} className="text-muted">
                        <span style={{ color: "#8aa", marginRight: 6 }}>{meal}:</span>
                        <span>Protein {m?.protein ?? 0}g</span>
                        <span style={{ margin: "0 8px" }}>·</span>
                        <span>Grams {m?.grams ?? 0}</span>
                        <span style={{ margin: "0 8px" }}>·</span>
                        <span>{m?.items ?? 0} items</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // === Generic compact renderer (habits/workouts) ===
  const renderListGeneric = (items?: { id: string; data: any }[]) => {
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
          ]
            .filter(Boolean)
            .join(" · ");

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
    tab === "checkins"
      ? loadingCheckins
      : tab === "habits"
      ? loadingHabits
      : tab === "nutrition"
      ? loadingNutrition
      : loadingWorkouts;

  const onLoadMore = () => {
    setCursors((c) => ({ ...c, [tab]: nextCursor[tab] || null }));
  };

  // ---- Charts (same size, within Check-ins tab)
  const weightChart = useMemo(() => {
    const src = (checkinsSeries?.results || []).slice().reverse();
    if (!src.length) return null;
    const labels = src.map((r) => fmtChartLabel(r.date));
    const data = src.map((r) => (typeof r.weight_kg === "number" ? r.weight_kg : null));

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Weight (kg)",
          data: data as (number | null)[],
          borderColor: "#4fa3a5",
          backgroundColor: "rgba(79,163,165,0.25)",
          tension: 0.3,
          pointRadius: 2,
        } as ChartDataset<"line">,
      ],
    };
    const options: ChartOptions<"line"> = {
      responsive: true,
      plugins: { legend: { labels: { color: "#e9eef6" } } },
      scales: {
        x: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
      },
    };
    return { chartData, options };
  }, [checkinsSeries]);

  const bodyFatChart = useMemo(() => {
    const src = (checkinsSeries?.results || []).slice().reverse();
    if (!src.length) return null;
    const labels = src.map((r) => fmtChartLabel(r.date));
    const data = src.map((r) => (typeof r.body_fat_pct === "number" ? r.body_fat_pct : null));

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Body fat (%)",
          data: data as (number | null)[],
          borderColor: "#ff4fa3",
          backgroundColor: "rgba(255,79,163,0.25)",
          tension: 0.3,
          pointRadius: 2,
        } as ChartDataset<"line">,
      ],
    };
    const options: ChartOptions<"line"> = {
      responsive: true,
      plugins: { legend: { labels: { color: "#e9eef6" } } },
      scales: {
        x: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
      },
    };
    return { chartData, options };
  }, [checkinsSeries]);

  // ---- Admin Create Check-in modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  // Form fields (Option 2)
  const [weekDate, setWeekDate] = useState<string>(""); // YYYY-MM-DD (any date in the week)
  const [weight, setWeight] = useState<string>("");
  const [bodyFatPct, setBodyFatPct] = useState<string>("");
  const [energy, setEnergy] = useState<string>("");
  const [stress, setStress] = useState<string>("");
  const [sleep, setSleep] = useState<string>(""); // averge_hours_of_sleep
  const [calDiff, setCalDiff] = useState<string>(""); // calories_difficulty
  const [goalsAchieved, setGoalsAchieved] = useState<boolean | null>(null);
  const [nextGoals, setNextGoals] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Photos
  const [photoFront, setPhotoFront] = useState<string | null>(null);
  const [photoSide, setPhotoSide] = useState<string | null>(null);
  const [photoBack, setPhotoBack] = useState<string | null>(null);

  useEffect(() => {
    if (mounted && !weekDate) {
      const today = new Date();
      const ymd = today.toISOString().slice(0, 10);
      setWeekDate(ymd);
    }
  }, [mounted, weekDate]);

  async function handlePick(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string | null) => void
  ) {
    const f = e.target.files?.[0];
    if (!f) {
      setter(null);
      return;
    }
    try {
      const dataUrl = await imageFileToDataUrl(f, 1400, 0.82);
      setter(dataUrl);
    } catch (err: any) {
      setSaveErr(err?.message || "Failed to process image");
    }
  }

  const canSubmitCheckin =
    !saving &&
    email &&
    weekDate &&
    // allow partials; require at least one meaningful field
    !!(
      weight ||
      bodyFatPct ||
      energy ||
      stress ||
      sleep ||
      calDiff ||
      nextGoals ||
      notes ||
      photoFront ||
      photoSide ||
      photoBack ||
      goalsAchieved !== null
    );

  async function submitAdminCheckin(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitCheckin) return;
    setSaving(true);
    setSaveErr(null);
    setSaveOk(null);
    try {
      const params = new URLSearchParams();
      params.set("email", String(email));
      params.set("week", weekDate);

      // Build body (Option 2) + plural keys for side/back (UI compatibility)
      const body: any = {
        user_email: email,
        // Numbers as numbers where relevant (server also tolerates strings)
        ...(weight ? { weight: Number(weight) } : {}),
        ...(bodyFatPct ? { body_fat_pct: String(bodyFatPct) } : {}),
        ...(energy ? { energy_levels: String(energy) } : {}),
        ...(stress ? { stress_levels: String(stress) } : {}),
        ...(sleep ? { averge_hours_of_sleep: String(sleep) } : {}),
        ...(calDiff ? { calories_difficulty: String(calDiff) } : {}),
        ...(goalsAchieved !== null ? { weekly_goals_achieved: !!goalsAchieved } : {}),
        ...(nextGoals ? { next_week_goals: String(nextGoals) } : {}),
        ...(notes ? { notes: String(notes) } : {}),
      };

      if (photoFront) body.progress_photo_front = photoFront;
      if (photoSide) {
        body.progress_photo_side = photoSide;      // singular (new)
        body.progress_photos_side = photoSide;     // plural (current UI display)
      }
      if (photoBack) {
        body.progress_photo_back = photoBack;      // singular (new)
        body.progress_photos_back = photoBack;     // plural (current UI display)
      }

      const res = await fetch(`/api/admin/members/checkins/create?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed (${res.status}). ${txt || "Please try again."}`);
      }
      setSaveOk("Check-in saved.");
      // Refresh feeds/series
      mutateCheckins();
      if (seriesKey) {
        // force revalidate
        fetch(seriesKey).catch(() => {});
      }
      // keep modal open for consecutive entries if needed, but clear inputs
      // (We leave weekDate as-is for convenience)
      setWeight("");
      setBodyFatPct("");
      setEnergy("");
      setStress("");
      setSleep("");
      setCalDiff("");
      setGoalsAchieved(null);
      setNextGoals("");
      setNotes("");
      setPhotoFront(null);
      setPhotoSide(null);
      setPhotoBack(null);
    } catch (err: any) {
      setSaveErr(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>{titleName} • Admin • BXKR</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <Link href="/admin/members" className="btn btn-outline-secondary">← Back</Link>
          <h2 className="mb-0">Member</h2>
          <div className="d-flex gap-2">
            {(isAllowed && email) ? (
              <button
                className="btn btn-sm"
                onClick={() => setShowCreateModal(true)}
                style={{
                  borderRadius: 24,
                  color: "#fff",
                  background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                  boxShadow: `0 0 14px ${ACCENT}66`,
                }}
              >
                Create check‑in
              </button>
            ) : <div style={{ width: 80 }} />}
          </div>
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
              style={{
                background: "rgba(255,255,255,0.06)",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="fw-bold" style={{ fontSize: "1.25rem" }}>
                {titleName}
              </div>
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
                  {t === "checkins"
                    ? "Check-ins"
                    : t === "habits"
                    ? "Daily Habits"
                    : t === "nutrition"
                    ? "Nutrition"
                    : "Workouts"}
                </button>
              ))}
            </div>

            {/* Feed */}
            <section className="mb-3">
              {tab === "checkins" && (
                <>
                  {/* Charts row */}
                  <div className="row gx-3">
                    <div className="col-12 col-md-6 mb-3">
                      <div className="futuristic-card p-3">
                        <h6 className="mb-2" style={{ fontWeight: 700 }}>
                          Weight
                        </h6>
                        {weightChart ? (
                          <Line data={weightChart.chartData} options={weightChart.options} />
                        ) : (
                          <div className="text-dim">No check‑ins yet.</div>
                        )}
                      </div>
                    </div>
                    <div className="col-12 col-md-6 mb-3">
                      <div className="futuristic-card p-3">
                        <h6 className="mb-2" style={{ fontWeight: 700 }}>
                          Body fat
                        </h6>
                        {bodyFatChart ? (
                          <Line data={bodyFatChart.chartData} options={bodyFatChart.options} />
                        ) : (
                          <div className="text-dim">No check‑ins yet.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Existing Check-ins list */}
                  {renderCheckins(checkinsData?.items)}
                </>
              )}
              {tab === "habits" && renderListGeneric(habitsData?.items)}
              {tab === "nutrition" && renderNutrition(nutritionData?.items)}
              {tab === "workouts" && renderListGeneric(workoutsData?.items)}
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

      {/* Create Check-in Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed top-0 left-0 w-100 h-100"
          style={{
            zIndex: 1050,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
          onClick={() => {
            if (!saving) setShowCreateModal(false);
          }}
        >
          <div
            className="futuristic-card p-3"
            style={{ width: "100%", maxWidth: 720 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h5 className="mb-0">Create check‑in</h5>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => !saving && setShowCreateModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="small text-dim">Save a weekly check‑in for this member</div>

            <form onSubmit={submitAdminCheckin} className="mt-3">
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label className="form-label">Week (any day in week)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={weekDate}
                    onChange={(e) => setWeekDate(e.target.value)}
                    required
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g., 84.2"
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label">Body fat (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control"
                    value={bodyFatPct}
                    onChange={(e) => setBodyFatPct(e.target.value)}
                    placeholder="e.g., 18.5"
                  />
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label">Energy</label>
                  <input
                    type="text"
                    className="form-control"
                    value={energy}
                    onChange={(e) => setEnergy(e.target.value)}
                    placeholder="Low / Medium / High"
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label">Stress</label>
                  <input
                    type="text"
                    className="form-control"
                    value={stress}
                    onChange={(e) => setStress(e.target.value)}
                    placeholder="Low / Medium / High"
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label">Avg sleep (hrs)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={sleep}
                    onChange={(e) => setSleep(e.target.value)}
                    placeholder="e.g., 7.5"
                  />
                </div>

                <div className="col-6 col-md-4">
                  <label className="form-label">Calories difficulty</label>
                  <input
                    type="text"
                    className="form-control"
                    value={calDiff}
                    onChange={(e) => setCalDiff(e.target.value)}
                    placeholder="Easy / OK / Hard"
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label">Goals achieved?</label>
                  <select
                    className="form-select"
                    value={goalsAchieved === null ? "" : goalsAchieved ? "yes" : "no"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGoalsAchieved(v === "" ? null : v === "yes");
                    }}
                  >
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label">Next week goals</label>
                  <input
                    type="text"
                    className="form-control"
                    value={nextGoals}
                    onChange={(e) => setNextGoals(e.target.value)}
                    placeholder="Short note for next week"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes"
                  />
                </div>

                {/* Photos */}
                <div className="col-12">
                  <div className="small text-dim mb-1">Progress photos (auto‑compressed)</div>
                  <div className="row g-2">
                    <div className="col-12 col-md-4">
                      <label className="form-label">Front</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-control"
                        onChange={(e) => handlePick(e, setPhotoFront)}
                      />
                      {photoFront && (
                        <div className="small mt-1" style={{ color: "#9fb0c3" }}>
                          Ready to upload
                        </div>
                      )}
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Side</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-control"
                        onChange={(e) => handlePick(e, setPhotoSide)}
                      />
                      {photoSide && (
                        <div className="small mt-1" style={{ color: "#9fb0c3" }}>
                          Ready to upload
                        </div>
                      )}
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Back</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-control"
                        onChange={(e) => handlePick(e, setPhotoBack)}
                      />
                      {photoBack && (
                        <div className="small mt-1" style={{ color: "#9fb0c3" }}>
                          Ready to upload
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {saveErr && (
                <div
                  role="alert"
                  className="mt-3"
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(255,0,0,0.35)",
                    background: "rgba(255,0,0,0.1)",
                    color: "#ffb3b3",
                    padding: "8px 12px",
                  }}
                >
                  {saveErr}
                </div>
              )}
              {saveOk && (
                <div
                  role="status"
                  className="mt-3"
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(16,185,129,0.35)",
                    background: "rgba(16,185,129,0.12)",
                    color: "#a7f3d0",
                    padding: "8px 12px",
                  }}
                >
                  {saveOk}
                </div>
              )}

              <div className="d-flex gap-2 mt-3">
                <button
                  type="submit"
                  disabled={!canSubmitCheckin}
                  className="btn"
                  style={{
                    borderRadius: 24,
                    color: "#0a0a0c",
                    background: canSubmitCheckin
                      ? `linear-gradient(90deg, ${ACCENT}, #ff7f32)`
                      : "linear-gradient(90deg, #777, #555)",
                    boxShadow: canSubmitCheckin ? `0 0 0.5rem ${ACCENT}55, 0 0 1.25rem ${ACCENT}44` : "none",
                    border: `1px solid ${ACCENT}55`,
                    opacity: saving ? 0.85 : 1,
                  }}
                  aria-busy={saving}
                >
                  {saving ? "Saving…" : "Save check‑in"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  style={{ borderRadius: 24 }}
                  onClick={() => !saving && setShowCreateModal(false)}
                >
                  Close
                </button>
              </div>
            </form>
            <div className="small text-dim mt-2">
              Photos are downscaled client‑side; server caps at ~900 KB per image.
            </div>
          </div>
        </div>
      )}

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

// === Check-ins card (unchanged from your renderer)
function CheckinCard({
  week,
  updated,
  weight,
  stress,
  goalsAchieved,
  notes,
  nextGoals,
  photos,
}: {
  week?: string;
  updated?: string;
  weight?: number;
  stress?: string;
  goalsAchieved?: string;
  notes?: string;
  nextGoals?: string;
  photos: {
    front?: string;
    side?: string;
    back?: string;
  };
}) {
  const [showPhotos, setShowPhotos] = useState(false);
  const hasPhotos = Object.values(photos).some(Boolean);

  return (
    <div
      className="p-3"
      style={{
        background: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="fw-semibold mb-1" style={{ color: "#fff" }}>
        Week ending <span style={{ color: ACCENT }}>{week || "—"}</span>
      </div>
      <div className="small text-muted mb-2">
        Updated {updated ? new Date(updated).toLocaleString() : "—"}
      </div>

      <div className="row g-2 mb-2">
        <div className="col-6 col-md-3">
          <div className="small text-muted">Weight</div>
          <div className="fw-semibold">{weight ?? "—"}</div>
        </div>
        <div className="col-6 col-md-3">
          <div className="small text-muted">Stress</div>
          <div className="fw-semibold">{stress ?? "—"}</div>
        </div>
        <div className="col-6 col-md-3">
          <div className="small text-muted">Goals Achieved</div>
          <div className="fw-semibold">{goalsAchieved ?? "—"}</div>
        </div>
      </div>

      {notes && (
        <div className="mb-2">
          <div className="small text-muted">Notes</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{notes}</div>
        </div>
      )}
      {nextGoals && (
        <div className="mb-2">
          <div className="small text-muted">Next week goals</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{nextGoals}</div>
        </div>
      )}

      {hasPhotos && (
        <>
          <button
            className="btn btn-sm btn-outline-secondary mt-2"
            onClick={() => setShowPhotos((v) => !v)}
          >
            {showPhotos ? "Hide photos" : "Show progress photos"}
          </button>

          {showPhotos && (
            <div className="row g-2 mt-2">
              {photos.front && <PhotoThumb label="Front" src={photos.front} />}
              {photos.side && <PhotoThumb label="Side" src={photos.side} />}
              {photos.back && <PhotoThumb label="Back" src={photos.back} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PhotoThumb({ label, src }: { label: string; src: string }) {
  return (
    <div className="col-12 col-md-4">
      <div className="small text-muted mb-1">{label}</div>
      <img
        src={src}
        alt={`${label} progress`}
        loading="lazy"
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      />
    </div>
  );
}

// Force SSR (prevents static export attempting to pre-render a dynamic route)
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};
