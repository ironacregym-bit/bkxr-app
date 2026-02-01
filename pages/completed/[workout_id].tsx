import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

const ACCENT = "#FF8A2A";
const BG_DARK = "#0a0a0c";
const TEXT = "#f3f7ff";

// Brand assets
const LOGO_URL = "/BXKRLogoNoBG.jpg";
const BG_URL = "/brand/share-bg.jpg";

// Fixed Peloton-style title
const TITLE_TEXT = "Workout Complete (Train. Fuel. Repeat.)";

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

const fetcher = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : null));

function toISO(v: any): string | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate().toISOString();
    if (v?.seconds) return new Date(v.seconds * 1000).toISOString();
    if (typeof v === "string") return new Date(v).toISOString();
    return null;
  } catch { return null; }
}
function numOrNull(x: any): number | null { const n = Number(x); return Number.isFinite(n) ? n : null; }
function pickDuration(c: LastCompletion | null): number | null {
  if (!c) return null;
  return typeof c.duration_minutes === "number" ? c.duration_minutes : typeof c.duration === "number" ? c.duration : null;
}
function rpeToDifficulty(rpe?: number | null): "Easy" | "Medium" | "Hard" | "—" {
  if (rpe == null || Number.isNaN(rpe)) return "—";
  if (rpe <= 4) return "Easy"; if (rpe <= 7) return "Medium"; return "Hard";
}
function heaviestOverall(sets: CompletionSet[] | undefined): CompletionSet | null {
  let top: CompletionSet | null = null;
  (sets || []).forEach((s) => {
    if (!top) top = s;
    else {
      const wt = top.weight ?? 0, wr = s.weight ?? 0;
      const rt = top.reps ?? 0, rr = s.reps ?? 0;
      if (wr > wt || (wr === wt && rr > rt)) top = s;
    }
  });
  return top;
}
function summariseBenchmark(metrics?: BenchmarkMetrics | null) {
  let rounds = 0; let maxLoad = 0;
  if (metrics && typeof metrics === "object") {
    Object.values(metrics).forEach((p) => {
      if (!p) return;
      if (typeof p.rounds_completed === "number") rounds += Math.max(0, Math.floor(p.rounds_completed));
      if (typeof p.weight_kg === "number") maxLoad = Math.max(maxLoad, p.weight_kg);
    });
  }
  return { rounds: rounds || null, maxLoad: maxLoad || null };
}

// ---- Canvas renderer (dynamic pills) ----
type Pill = { label: string; value: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.decoding = "async"; img.onload = () => resolve(img); img.onerror = reject; img.src = src;
  });
}
async function renderShareImage(opts: {
  mode: "story" | "square";
  title: string;
  dateText: string;
  pills: Pill[];
  notes?: string | null;
  bgUrl: string;
  logoUrl: string;
}): Promise<{ blob: Blob; dataUrl: string }> {
  const W = 1080, H = opts.mode === "story" ? 1920 : 1080;
  let bgImg: HTMLImageElement | null = null, logoImg: HTMLImageElement | null = null;
  try { bgImg = await loadImage(opts.bgUrl); } catch {}
  try { logoImg = await loadImage(opts.logoUrl); } catch {}
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BG_DARK; ctx.fillRect(0, 0, W, H);
  if (bgImg) {
    const rC = W / H, rI = bgImg.width / bgImg.height;
    let dw = W, dh = H, dx = 0, dy = 0;
    if (rI > rC) { dh = H; dw = (bgImg.width / bgImg.height) * dh; dx = (W - dw) / 2; }
    else { dw = W; dh = (bgImg.height / bgImg.width) * dw; dy = (H - dh) / 2; }
    ctx.drawImage(bgImg, dx, dy, dw, dh);
  }
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0.55)"); grad.addColorStop(0.5, "rgba(0,0,0,0.62)"); grad.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  if (logoImg) {
    const LOGO_W = 220, LOGO_H = (logoImg.height / logoImg.width) * LOGO_W;
    ctx.drawImage(logoImg, W - LOGO_W - 48, 48, LOGO_W, LOGO_H);
  } else {
    ctx.fillStyle = ACCENT; roundRect(ctx, W - 260, 48, 212, 80, 16); ctx.fill();
    ctx.fillStyle = "#0b0f14"; ctx.font = "900 44px Inter, system-ui, -apple-system, Segoe UI, Roboto"; ctx.textAlign = "center";
    ctx.fillText("BXKR", W - 260 + 106, 48 + 54);
  }
  ctx.fillStyle = TEXT; ctx.textAlign = "left";
  ctx.font = "800 66px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(trimFit(ctx, opts.title, 48, W - 48 - 280, 66), 48, 140);
  ctx.globalAlpha = 0.8; ctx.font = "400 34px Inter, system-ui, -apple-system, Segoe UI, Roboto"; ctx.fillText(opts.dateText, 48, 188); ctx.globalAlpha = 1;

  const PILL_W = 520, PILL_H = 190, GAP = 26, TOP = 260;
  (opts.pills || []).slice(0, 4).forEach((p, i) => {
    const x = 48, y = TOP + i * (PILL_H + GAP);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; roundRect(ctx, x, y, PILL_W, PILL_H, 24); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1; roundRect(ctx, x, y, PILL_W, PILL_H, 24); ctx.stroke();
    ctx.fillStyle = TEXT; ctx.textAlign = "left";
    ctx.font = "700 76px Inter, system-ui, -apple-system, Segoe UI, Roboto"; ctx.fillText(p.value, x + 30, y + 112);
    ctx.globalAlpha = 0.85; ctx.font = "600 28px Inter, system-ui, -apple-system, Segoe UI, Roboto"; ctx.fillText(p.label, x + 30, y + 48); ctx.globalAlpha = 1;
  });

  if (opts.notes && opts.notes.trim()) {
    ctx.globalAlpha = 0.9; ctx.font = "400 30px Inter, system-ui, -apple-system, Segoe UI, Roboto"; ctx.fillStyle = TEXT;
    ctx.fillText(trimFit(ctx, opts.notes.trim(), 48, W - 96, 30), 48, H - 88); ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.75; ctx.font = "600 28px Inter, system-ui, -apple-system, Segoe UI, Roboto"; ctx.fillStyle = TEXT;
  ctx.fillText("BXKR • Train. Fuel. Repeat.", 48, H - 40); ctx.globalAlpha = 1;

  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  const dataUrl = canvas.toDataURL("image/png");
  return { blob, dataUrl };
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}
function trimFit(ctx: CanvasRenderingContext2D, s: string, x: number, maxWidth: number, fontSize: number) {
  if (ctx.measureText(s).width <= maxWidth) return s; let out = s;
  while (out.length > 2 && ctx.measureText(out + "…").width > maxWidth) out = out.slice(0, -1);
  return out + "…";
}
async function shareViaSystem(blob: Blob, filename = "bxkr-story.png") {
  try { const file = new File([blob], filename, { type: blob.type });
    if ((navigator as any).canShare?.({ files: [file] })) { await (navigator as any).share({ files: [file], title: "BXKR", text: "Train. Fuel. Repeat." }); return true; }
  } catch {} return false;
}
function tryDeepLink(uri: string) { try { window.location.href = uri; } catch {} }

// ---- Page ----
export default function CompletedPelotonStylePage() {
  const router = useRouter();
  const { workout_id } = router.query as { workout_id?: string };
  const url = workout_id && typeof workout_id === "string" ? `/api/completions/last?workout_id=${encodeURIComponent(workout_id)}` : null;

  const { data } = useSWR<LastCompletion | { ok: boolean; last?: LastCompletion }>(url, fetcher, { revalidateOnFocus: false });
  const last: LastCompletion | null = useMemo(() => (!data ? null : (data as any).ok ? (data as any).last ?? null : (data as LastCompletion))), [data];

  // Core fields
  const iso = toISO(last?.completed_date) || toISO(last?.date_completed) || new Date().toISOString();
  const dateText = useMemo(() => new Date(iso!).toLocaleString(undefined, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }), [iso]);
  const calories = typeof last?.calories_burned === "number" ? Math.round(last.calories_burned) : null;
  const duration = pickDuration(last);
  const difficulty = rpeToDifficulty(last?.rpe ?? last?.rating ?? null);
  const notes = last?.notes ?? null;

  // Type detection
  const isGym = (last?.sets || []).length > 0 || (last?.activity_type || "").toLowerCase().includes("strength");
  const isBXKR = !!last?.is_benchmark || !!last?.benchmark_metrics;

  // Gym: Top Lift
  const topLift = heaviestOverall(last?.sets);
  const topLiftText = topLift ? `${topLift.exercise_id} ${Math.round(topLift.weight ?? 0)} kg` : "—";

  // BXKR: Rounds + Load
  const bm = last?.benchmark_metrics || null;
  const { rounds, maxLoad } = summariseBenchmark(bm);
  const roundsText = rounds != null ? String(rounds) : (typeof last?.sets_completed === "number" ? String(last.sets_completed) : "—");
  const loadText = maxLoad != null
    ? `${Math.round(maxLoad)} kg`
    : (typeof last?.weight_completed_with === "number" ? `${Math.round(last.weight_completed_with)} kg` : "—");

  // Pill stack
  const pills: Pill[] = isGym
    ? [
        { label: "CALORIES", value: calories != null ? `${calories} kcal` : "—" },
        { label: "TOP LIFT", value: topLiftText },
        { label: "TIME", value: duration != null ? `${Math.round(duration)} min` : "—" },
        { label: "DIFFICULTY", value: difficulty },
      ]
    : isBXKR
    ? [
        { label: "CALORIES", value: calories != null ? `${calories} kcal` : "—" },
        { label: "ROUNDS", value: roundsText },
        { label: "TIME", value: duration != null ? `${Math.round(duration)} min` : "—" },
        { label: "LOAD", value: loadText },
      ]
    : [
        { label: "CALORIES", value: calories != null ? `${calories} kcal` : "—" },
        { label: "TIME", value: duration != null ? `${Math.round(duration)} min` : "—" },
        { label: "DIFFICULTY", value: difficulty },
        { label: " ", value: " " },
      ];

  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { dataUrl } = await renderShareImage({ mode: "story", title: TITLE_TEXT, dateText, pills, notes, bgUrl: BG_URL, logoUrl: LOGO_URL });
      if (alive) setPreviewUrl(dataUrl);
    })();
    return () => { alive = false; };
  }, [dateText, JSON.stringify(pills), notes]);

  async function renderBlob(mode: "story" | "square") {
    const { blob } = await renderShareImage({ mode, title: TITLE_TEXT, dateText, pills, notes, bgUrl: BG_URL, logoUrl: LOGO_URL });
    return blob;
  }
  async function download(mode: "story" | "square") {
    setBusy(true);
    try { const blob = await renderBlob(mode); const a = document.createElement("a"); const u = URL.createObjectURL(blob); a.href = u; a.download = `bxkr-${mode}.png`; a.click(); URL.revokeObjectURL(u); }
    finally { setBusy(false); }
  }
  async function shareInstagram() {
    setBusy(true);
    try { const blob = await renderBlob("story"); const shared = await shareViaSystem(blob, "bxkr-story.png"); tryDeepLink("instagram://story-camera");
      if (!shared) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = "bxkr-story.png"; a.click(); URL.revokeObjectURL(u); } }
    finally { setBusy(false); }
  }
  async function shareFacebook() {
    setBusy(true);
    try { const blob = await renderBlob("story"); const shared = await shareViaSystem(blob, "bxkr-story.png"); tryDeepLink("fb://story-camera");
      if (!shared) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = "bxkr-story.png"; a.click(); URL.revokeObjectURL(u); } }
    finally { setBusy(false); }
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
          <Link href="/" className="btn btn-bxkr-outline" style={{ borderRadius: 24 }}>← Back</Link>
          <h1 className="h5 m-0">Share • Completed</h1>
          <div />
        </div>

        <section className="futuristic-card p-2 mb-3">
          <div style={{ width: "100%", maxWidth: 380, marginInline: "auto", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 0 24px rgba(0,0,0,0.35)" }}>
            {previewUrl ? <img src={previewUrl} alt="Story preview" style={{ width: "100%", height: "auto", display: "block" }} /> : <div className="p-5 text-center text-dim small">Preparing preview…</div>}
          </div>
          <div className="small text-dim text-center mt-2">Story preview (1080×1920)</div>
        </section>

        <section className="futuristic-card p-3 mb-3">
          <div className="d-flex flex-wrap align-items-center justify-content-center" style={{ gap: 10 }}>
            <button className="btn btn-sm" onClick={shareInstagram} disabled={busy} style={{ borderRadius: 24, color: "#0a0a0c", background: `linear-gradient(90deg, ${ACCENT}, #ff7f32)`, border: "none", minWidth: 200, fontWeight: 700 }}>
              {busy ? "Working…" : "Share to Instagram Stories"}
            </button>
            <button className="btn btn-sm" onClick={shareFacebook} disabled={busy} style={{ borderRadius: 24, color: "#0a0a0c", background: `linear-gradient(90deg, ${ACCENT}, #ff7f32)`, border: "none", minWidth: 200, fontWeight: 700 }}>
              {busy ? "Working…" : "Share to Facebook Stories"}
            </button>
            <div className="vr" />
            <button className="btn btn-sm btn-bxkr-outline" onClick={() => download("story")} disabled={busy} style={{ borderRadius: 24, minWidth: 200 }}>
              {busy ? "Preparing…" : "Download Story PNG"}
            </button>
            <button className="btn btn-sm btn-bxkr-outline" onClick={() => download("square")} disabled={busy} style={{ borderRadius: 24, minWidth: 200 }}>
              {busy ? "Preparing…" : "Download Square PNG"}
            </button>
          </div>
          {!last && <div className="alert alert-info mt-3 mb-0">No completion found yet. You can still share this template.</div>}
        </section>
      </main>

      <BottomNav />
    </>
  );
}
