// pages/completed/[workout_id].tsx
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../../components/BottomNav";

const ACCENT = "#FF8A2A";
const ACCENT_2 = "#ff7f32";
const BG_DARK = "#0a0a0c";
const TEXT = "#f3f7ff";

// Brand assets
const LOGO_URL = "/BXKRLogoNoBG.jpg";
const BG_URL = "/brand/share-bg.jpg";

// Title to show in the bottom caption bar
const TITLE_TEXT = "Workout Complete (Train. Fuel. Repeat.)";

// ---------------- Types ----------------
type CompletionSet = { exercise_id: string; set: number; weight: number | null; reps: number | null };
type BenchmarkPart = { style?: string; rounds_completed?: number | null; weight_kg?: number | null; notes?: string | null };
type BenchmarkMetrics = Partial<Record<"engine" | "power" | "core" | "ladder" | "load", BenchmarkPart>>;

type LastCompletion = {
  id?: string;
  workout_id?: string;
  workout_name?: string;
  completed_date?: any;
  date_completed?: any;
  calories_burned?: number | null;
  duration_minutes?: number | null;
  duration?: number | null; // legacy
  rpe?: number | null;
  rating?: number | null;   // legacy
  notes?: string | null;
  weight_completed_with?: number | string | null;
  activity_type?: string | null;
  sets?: CompletionSet[];
  is_benchmark?: boolean;
  benchmark_metrics?: BenchmarkMetrics | null;
  sets_completed?: number | null;
};

type HistoryItem = LastCompletion & { id: string };

type WorkoutDoc = {
  workout_name: string;
  notes?: string | null;
};

const fetcher = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : null));

// ---------------- util ----------------
function toISO(v: any): string | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate().toISOString();
    if (v?.seconds) return new Date(v.seconds * 1000).toISOString();
    if (typeof v === "string") return new Date(v).toISOString();
    return null;
  } catch {
    return null;
  }
}
function pickDuration(c: LastCompletion | null): number | null {
  if (!c) return null;
  return typeof c.duration_minutes === "number"
    ? c.duration_minutes
    : typeof c.duration === "number"
    ? c.duration
    : null;
}
function heaviestOverall(sets: CompletionSet[] | undefined): CompletionSet | null {
  let top: CompletionSet | null = null;
  (sets || []).forEach((s) => {
    if (!top) {
      top = s;
      return;
    }
    const wt = top.weight ?? 0,
      wr = s.weight ?? 0;
    const rt = top.reps ?? 0,
      rr = s.reps ?? 0;
    if (wr > wt || (wr === wt && rr > rt)) top = s;
  });
  return top;
}
function bestSetByExercise(sets: CompletionSet[] | undefined) {
  const m = new Map<string, CompletionSet>();
  (sets || []).forEach((s) => {
    const prev = m.get(s.exercise_id);
    if (!prev) m.set(s.exercise_id, s);
    else {
      const pw = prev.weight ?? 0,
        pr = prev.reps ?? 0;
      const w = s.weight ?? 0,
        r = s.reps ?? 0;
      if (w > pw || (w === pw && r > pr)) m.set(s.exercise_id, s);
    }
  });
  return m;
}
function percentDelta(now: number, prev: number): number | null {
  if (!isFinite(now) || !isFinite(prev) || prev <= 0) return null;
  return ((now - prev) / prev) * 100;
}
function totalVolume(sets: CompletionSet[] | undefined) {
  return (sets || []).reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0);
}
function summariseBenchmark(metrics?: BenchmarkMetrics | null) {
  let rounds = 0;
  let maxLoad = 0;
  if (metrics && typeof metrics === "object") {
    Object.values(metrics).forEach((p) => {
      if (!p) return;
      if (typeof p.rounds_completed === "number")
        rounds += Math.max(0, Math.floor(p.rounds_completed));
      if (typeof p.weight_kg === "number") maxLoad = Math.max(maxLoad, p.weight_kg);
    });
  }
  return { rounds: rounds || null, maxLoad: maxLoad || null };
}

// ---------------- canvas renderer ----------------
type Pill = { label: string; value: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Peloton-like composition, BXKR colours:
 * - left accent rail
 * - vertical metric tiles (glass)
 * - BXKR logo top-right
 * - bottom caption bar: left=TITLE_TEXT, right=workout name + description
 */
async function renderShareImage(opts: {
  mode: "story" | "square";
  dateText: string;
  pills: Pill[]; // up to 4
  bgUrl: string;
  logoUrl: string;
  captionLeft: string; // "Workout Complete (…)"
  captionRightTitle?: string | null; // workout_name
  captionRightDesc?: string | null; // description/notes
}): Promise<{ blob: Blob; dataUrl: string }> {
  const W = 1080,
    H = opts.mode === "story" ? 1920 : 1080;

  let bgImg: HTMLImageElement | null = null,
    logoImg: HTMLImageElement | null = null;
  try {
    bgImg = await loadImage(opts.bgUrl);
  } catch {}
  try {
    logoImg = await loadImage(opts.logoUrl);
  } catch {}

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Base + cover image
  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, W, H);
  if (bgImg) {
    const rC = W / H,
      rI = bgImg.width / bgImg.height;
    let dw = W,
      dh = H,
      dx = 0,
      dy = 0;
    if (rI > rC) {
      dh = H;
      dw = (bgImg.width / bgImg.height) * dh;
      dx = (W - dw) / 2;
    } else {
      dw = W;
      dh = (bgImg.height / bgImg.width) * dw;
      dy = (H - dh) / 2;
    }
    ctx.drawImage(bgImg, dx, dy, dw, dh);
  }

  // Vignette overlay
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.4, "rgba(0,0,0,0.66)");
  grad.addColorStop(1, "rgba(0,0,0,0.80)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Left accent rail
  const railGrad = ctx.createLinearGradient(36, 0, 42, 0);
  railGrad.addColorStop(0, ACCENT);
  railGrad.addColorStop(1, ACCENT_2);
  ctx.fillStyle = railGrad;
  roundRect(ctx, 36, 180, 6, H - 420, 3);
  ctx.fill();

  // Logo top-right
  if (logoImg) {
    const LW = 200,
      LH = (logoImg.height / logoImg.width) * LW;
    ctx.drawImage(logoImg, W - LW - 48, 52, LW, LH);
  } else {
    ctx.fillStyle = ACCENT;
    roundRect(ctx, W - 240, 48, 192, 72, 16);
    ctx.fill();
    ctx.fillStyle = "#0b0f14";
    ctx.textAlign = "center";
    ctx.font = "800 40px Inter, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("BXKR", W - 240 + 96, 48 + 50);
  }

  // Datestamp (top-left)
  ctx.fillStyle = "#cbd5e1";
  ctx.textAlign = "left";
  ctx.globalAlpha = 0.9;
  ctx.font = "500 34px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(opts.dateText, 60, 140);
  ctx.globalAlpha = 1;

  // Metric tiles (left column)
  const PILL_W = 560,
    PILL_H = 170,
    GAP = 24,
    TOP = 200,
    R = 20;
  (opts.pills || []).slice(0, 4).forEach((p, i) => {
    const x = 60,
      y = TOP + i * (PILL_H + GAP);
    // glass tile
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, x, y, PILL_W, PILL_H, R);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, PILL_W, PILL_H, R);
    ctx.stroke();
    // orange hairline at left edge of tile
    const lgrad = ctx.createLinearGradient(x, y, x + 10, y);
    lgrad.addColorStop(0, ACCENT);
    lgrad.addColorStop(1, "rgba(255,138,42,0)");
    ctx.fillStyle = lgrad;
    roundRect(ctx, x, y, 5, PILL_H, R);
    ctx.fill();

    // label (thin)
    ctx.fillStyle = "#b6c3d7";
    ctx.textAlign = "left";
    ctx.font = "600 24px Inter, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(p.label.toUpperCase(), x + 24, y + 44);

    // value (thinner weight)
    ctx.fillStyle = TEXT;
    ctx.font = "600 58px Inter, system-ui, -apple-system, Segoe UI, Roboto";
    const value = clamp(ctx, p.value, PILL_W - 52);
    ctx.fillText(value, x + 24, y + 108);
  });

  // Bottom caption bar
  const BAR_H = 200;
  const barY = H - BAR_H;
  ctx.fillStyle = "rgba(0,0,0,0.68)";
  roundRect(ctx, 0, barY, W, BAR_H, 0);
  ctx.fill();
  // top accent line
  const barGrad = ctx.createLinearGradient(0, barY, W, barY);
  barGrad.addColorStop(0, ACCENT);
  barGrad.addColorStop(1, ACCENT_2);
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, barY, W, 3);

  // left caption
  ctx.fillStyle = "#e8eef8";
  ctx.textAlign = "left";
  ctx.font = "700 48px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(clamp(ctx, opts.captionLeft, W * 0.55 - 48), 48, barY + 84);

  // right caption (workout name + description)
  const rightX = W * 0.55;
  const rightW = W - rightX - 48;
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 40px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  const title = (opts.captionRightTitle || "").trim() || "BXKR Workout";
  ctx.fillText(clamp(ctx, title, rightW), W - 48, barY + 72);

  if (opts.captionRightDesc && opts.captionRightDesc.trim()) {
    ctx.fillStyle = "#d0d8e6";
    ctx.font = "500 28px Inter, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(clamp(ctx, opts.captionRightDesc.trim(), rightW), W - 48, barY + 122);
  }

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png")
  );
  const dataUrl = canvas.toDataURL("image/png");
  return { blob, dataUrl };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function clamp(ctx: CanvasRenderingContext2D, s: string, maxWidth: number) {
  if (!s) return "";
  if (ctx.measureText(s).width <= maxWidth) return s;
  let out = s;
  while (out.length > 2 && ctx.measureText(out + "…").width > maxWidth) out = out.slice(0, -1);
  return out + "…";
}

// ---------------- Page ----------------
export default function CompletedPelotonStylePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { workout_id } = router.query as { workout_id?: string };
  const url =
    workout_id && typeof workout_id === "string"
      ? `/api/completions/last?workout_id=${encodeURIComponent(workout_id)}`
      : null;

  // last completion
  const { data: swrData } = useSWR<LastCompletion | { ok: boolean; last?: LastCompletion }>(
    url,
    fetcher,
    { revalidateOnFocus: false }
  );
  const last: LastCompletion | null = useMemo(
    () => (!swrData ? null : (swrData as any).ok ? (swrData as any).last ?? null : (swrData as LastCompletion)),
    [swrData]
  );

  // fetch workout doc for name/description in caption (optional, best-effort)
  const workoutUrl =
    workout_id && typeof workout_id === "string"
      ? `/api/workouts/${encodeURIComponent(workout_id)}`
      : null;
  const { data: wData } = useSWR<WorkoutDoc>(workoutUrl, fetcher, {
    revalidateOnFocus: false,
  });

  // short history (for "Most Improved")
  const email = (session?.user as any)?.email || "";
  const histUrl =
    workout_id && typeof workout_id === "string" && email
      ? `/api/completions/history?email=${encodeURIComponent(email)}&workout_id=${encodeURIComponent(
          workout_id
        )}&limit=6`
      : null;
  const { data: histResp } = useSWR<{ results: HistoryItem[]; history: HistoryItem[] }>(
    histUrl,
    fetcher,
    { revalidateOnFocus: false }
  );
  const history = useMemo<HistoryItem[]>(
    () => (histResp?.results || histResp?.history || []) as HistoryItem[],
    [histResp]
  );

  // Core fields
  const iso =
    toISO(last?.completed_date) || toISO(last?.date_completed) || new Date().toISOString();
  const dateText = useMemo(
    () =>
      new Date(iso!).toLocaleString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [iso]
  );
  const calories =
    typeof last?.calories_burned === "number" ? Math.round(last.calories_burned) : null;
  const duration = pickDuration(last);

  // Type detection (legacy compatibility only)
  const isGym =
    (last?.sets || []).length > 0 ||
    (last?.activity_type || "").toLowerCase().includes("strength");
  const isBXKR = !!last?.is_benchmark || !!last?.benchmark_metrics;

  // Most Improved (PB) vs Top Lift
  const currentBest = bestSetByExercise(last?.sets);
  const prevDocs = history.filter((h) => !last?.id || h.id !== last?.id);
  const prevBest = bestSetByExercise(prevDocs.flatMap((h) => h.sets || []));

  let improvedLabel: string | null = null;
  let improvedDelta: number | null = null;
  currentBest.forEach((cur, ex) => {
    const wNow = cur.weight ?? 0;
    const p = prevBest.get(ex);
    const wPrev = p?.weight ?? 0;
    const d = percentDelta(wNow, wPrev);
    if (d != null && d > 0.0001) {
      if (improvedDelta == null || d > improvedDelta) {
        improvedDelta = d;
        improvedLabel = ex;
      }
    }
  });

  const topLift = heaviestOverall(last?.sets);
  const mostImprovedText =
    improvedLabel && typeof improvedDelta === "number"
      ? `${improvedLabel} +${improvedDelta.toFixed(1)}% PB`
      : topLift
      ? `${topLift.exercise_id} · ${Math.round(topLift.weight ?? 0)} kg`
      : "—";

  const vol = totalVolume(last?.sets);

  // Pills: Calories • Most Improved/Top Lift • Time • Volume
  const pills: Pill[] = [
    { label: "Calories", value: calories != null ? `${calories} kcal` : "—" },
    { label: "Most Improved", value: mostImprovedText },
    { label: "Time", value: duration != null ? `${Math.round(duration)} min` : "—" },
    { label: "Volume", value: vol > 0 ? `${Math.round(vol)} kg·reps` : "—" },
  ];

  // Caption right uses workout doc if available; fallback to completion
  const captionRightTitle = wData?.workout_name || last?.workout_name || null;
  const captionRightDesc =
    (wData?.notes && String(wData.notes)) ||
    null; // prefer workout description (not completion notes)

  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { dataUrl } = await renderShareImage({
        mode: "story",
        dateText,
        pills,
        bgUrl: BG_URL,
        logoUrl: LOGO_URL,
        captionLeft: TITLE_TEXT,
        captionRightTitle,
        captionRightDesc,
      });
      if (alive) setPreviewUrl(dataUrl);
    })();
    return () => {
      alive = false;
    };
  }, [dateText, JSON.stringify(pills), captionRightTitle, captionRightDesc]);

  async function renderBlob(mode: "story" | "square") {
    const { blob } = await renderShareImage({
      mode,
      dateText,
      pills,
      bgUrl: BG_URL,
      logoUrl: LOGO_URL,
      captionLeft: TITLE_TEXT,
      captionRightTitle,
      captionRightDesc,
    });
    return blob;
  }
  async function download(mode: "story" | "square") {
    setBusy(true);
    try {
      const blob = await renderBlob(mode);
      const a = document.createElement("a");
      const u = URL.createObjectURL(blob);
      a.href = u;
      a.download = `bxkr-${mode}.png`;
      a.click();
      URL.revokeObjectURL(u);
    } finally {
      setBusy(false);
    }
  }
  async function shareInstagram() {
    setBusy(true);
    try {
      const blob = await renderBlob("story");
      const shared = await shareViaSystem(blob, "bxkr-story.png");
      tryDeepLink("instagram://story-camera");
      if (!shared) {
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = "bxkr-story.png";
        a.click();
        URL.revokeObjectURL(u);
      }
    } finally {
      setBusy(false);
    }
  }
  async function shareFacebook() {
    setBusy(true);
    try {
      const blob = await renderBlob("story");
      const shared = await shareViaSystem(blob, "bxkr-story.png");
      tryDeepLink("fb://story-camera");
      if (!shared) {
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = "bxkr-story.png";
        a.click();
        URL.revokeObjectURL(u);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>{`Workout Complete • Share • BXKR`}</title>
        <meta property="og:title" content="Workout Complete • BXKR" />
        <meta property="og:description" content="Train. Fuel. Repeat." />
        <meta property="og:image" content="/og/share-placeholder.png" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="d-flex align-items-center justify-content-between mb-3" style={{ gap: 8 }}>
          <Link href="/" className="btn btn-bxkr-outline" style={{ borderRadius: 24 }}>
            ← Back
          </Link>
          <h1 className="h5 m-0">Share • Completed</h1>
          <div />
        </div>

        {/* Live preview */}
        <section className="futuristic-card p-2 mb-3">
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              marginInline: "auto",
              borderRadius: 24,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Story preview"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            ) : (
              <div className="p-5 text-center text-dim small">Preparing preview…</div>
            )}
          </div>
          <div className="small text-dim text-center mt-2">Story preview (1080×1920)</div>
        </section>

        {/* Actions */}
        <section className="futuristic-card p-3 mb-3">
          <div
            className="d-flex flex-wrap align-items-center justify-content-center"
            style={{ gap: 10 }}
          >
            <button
              className="btn btn-sm"
              onClick={shareInstagram}
              disabled={busy}
              style={{
                borderRadius: 24,
                color: "#0a0a0c",
                background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})`,
                border: "none",
                minWidth: 200,
                fontWeight: 700,
              }}
            >
              {busy ? "Working…" : "Share to Instagram Stories"}
            </button>
            <button
              className="btn btn-sm"
              onClick={shareFacebook}
              disabled={busy}
              style={{
                borderRadius: 24,
                color: "#0a0a0c",
                background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})`,
                border: "none",
                minWidth: 200,
                fontWeight: 700,
              }}
            >
              {busy ? "Working…" : "Share to Facebook Stories"}
            </button>

            <div className="vr" />

            <button
              className="btn btn-sm btn-bxkr-outline"
              onClick={() => download("story")}
              disabled={busy}
              style={{ borderRadius: 24, minWidth: 200 }}
            >
              {busy ? "Preparing…" : "Download Story PNG"}
            </button>
            <button
              className="btn btn-sm btn-bxkr-outline"
              onClick={() => download("square")}
              disabled={busy}
              style={{ borderRadius: 24, minWidth: 200 }}
            >
              {busy ? "Preparing…" : "Download Square PNG"}
            </button>
          </div>

          {!last && (
            <div className="alert alert-info mt-3 mb-0">
              No completion found yet. You can still share this template.
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}

/* ---- share helpers ---- */
async function shareViaSystem(blob: Blob, filename = "bxkr-story.png") {
  try {
    const file = new File([blob], filename, { type: blob.type });
    // @ts-ignore
    if (navigator?.canShare?.({ files: [file] })) {
      // @ts-ignore
      await navigator.share({ files: [file], title: "BXKR" });
      return true;
    }
  } catch {}
  return false;
}
function tryDeepLink(uri: string) {
  try {
    window.location.href = uri;
  } catch
}
