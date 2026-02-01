import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

const ACCENT = "#FF8A2A";
const BG_DARK = "#0a0a0c";
const TEXT = "#f3f7ff";

// --- Brand assets ---
// Logo: place your file at /public/BXKRLogoNoBG.jpg
// Background: put a portrait photo at /public/brand/share-bg.jpg (or adjust path below)
const LOGO_URL = "/BXKRLogoNoBG.jpg";
const BG_URL = "/brand/share-bg.jpg";

// Fixed Peloton-style title with motivation
const TITLE_TEXT = "Workout Complete (Train. Fuel. Repeat.)";

type CompletionSet = { exercise_id: string; set: number; weight: number | null; reps: number | null };
type LastCompletion = {
  workout_id?: string;
  workout_name?: string;
  completed_date?: any;
  calories_burned?: number | null;
  duration_minutes?: number | null;
  duration?: number | null;
  rpe?: number | null;
  rating?: number | null;
  notes?: string | null;
  weight_completed_with?: number | string | null;
  sets?: CompletionSet[];
};

const fetcher = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : null));

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
function niceN(n: any): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}
function pickDuration(c: LastCompletion | null): number | null {
  if (!c) return null;
  return typeof c.duration_minutes === "number"
    ? c.duration_minutes
    : typeof c.duration === "number"
    ? c.duration
    : null;
}
function heaviestWeight(c: LastCompletion | null): number | null {
  if (!c) return null;
  const summary = c.weight_completed_with;
  const summaryNum = niceN(summary as any);
  if (summaryNum != null) return summaryNum;
  const arr = Array.isArray(c.sets) ? c.sets : [];
  if (!arr.length) return null;
  return arr.reduce((m, s) => Math.max(m, niceN(s.weight) ?? 0), 0) || null;
}
function rpeToDifficulty(rpe?: number | null): "Easy" | "Medium" | "Hard" | "—" {
  if (rpe == null || Number.isNaN(rpe)) return "—";
  if (rpe <= 4) return "Easy";
  if (rpe <= 7) return "Medium";
  return "Hard";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Render Peloton‑style story/square PNG and return Blob + dataURL */
async function renderShareImage(opts: {
  mode: "story" | "square";
  title: string;
  dateText: string;
  calories: number | null;
  weightUsed: number | null;
  duration: number | null;
  difficulty: string;
  notes?: string | null;
  bgUrl: string;   // full bleed background
  logoUrl: string; // BXKR logo
}): Promise<{ blob: Blob; dataUrl: string }> {
  const W = 1080;
  const H = opts.mode === "story" ? 1920 : 1080;

  // Load assets (placeholders ok)
  let bgImg: HTMLImageElement | null = null;
  let logoImg: HTMLImageElement | null = null;
  try { bgImg = await loadImage(opts.bgUrl); } catch {}
  try { logoImg = await loadImage(opts.logoUrl); } catch {}

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, W, H);

  // Background cover
  if (bgImg) {
    const rC = W / H;
    const rI = bgImg.width / bgImg.height;
    let drawW = W, drawH = H, dx = 0, dy = 0;
    if (rI > rC) { drawH = H; drawW = (bgImg.width / bgImg.height) * drawH; dx = (W - drawW) / 2; }
    else { drawW = W; drawH = (bgImg.height / bgImg.width) * drawW; dy = (H - drawH) / 2; }
    ctx.drawImage(bgImg, dx, dy, drawW, drawH);
  }

  // Dark overlay for readability
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.5, "rgba(0,0,0,0.62)");
  grad.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Logo (top-right)
  if (logoImg) {
    const LOGO_W = 220, LOGO_H = (logoImg.height / logoImg.width) * LOGO_W;
    ctx.drawImage(logoImg, W - LOGO_W - 48, 48, LOGO_W, LOGO_H);
  } else {
    ctx.fillStyle = ACCENT;
    roundRect(ctx, W - 260, 48, 212, 80, 16); ctx.fill();
    ctx.fillStyle = "#0b0f14";
    ctx.font = "900 44px Inter, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.textAlign = "center";
    ctx.fillText("BXKR", W - 260 + 106, 48 + 54);
  }

  // Title + date
  ctx.fillStyle = TEXT;
  ctx.textAlign = "left";
  ctx.font = "800 66px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(trimFit(ctx, opts.title, 48, W - 48 - 280, 66), 48, 140);
  ctx.globalAlpha = 0.8;
  ctx.font = "400 34px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(opts.dateText, 48, 188);
  ctx.globalAlpha = 1;

  // Metrics column (left), Peloton-style stacked cards
  const PILL_W = 520, PILL_H = 190, GAP = 26, TOP = 260;
  const pills = [
    { label: "CALORIES", value: opts.calories != null ? `${Math.round(opts.calories)} kcal` : "—" },
    { label: "WEIGHT USED", value: opts.weightUsed != null ? `${Math.round(opts.weightUsed)} kg` : "—" },
    { label: "TIME", value: opts.duration != null ? `${Math.round(opts.duration)} min` : "—" },
    { label: "DIFFICULTY", value: opts.difficulty || "—" },
  ];
  pills.forEach((p, i) => {
    const x = 48, y = TOP + i * (PILL_H + GAP);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, x, y, PILL_W, PILL_H, 24); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1;
    roundRect(ctx, x, y, PILL_W, PILL_H, 24); ctx.stroke();

    ctx.fillStyle = TEXT;
    ctx.textAlign = "left";
    ctx.font = "700 76px Inter, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(p.value, x + 30, y + 112);
    ctx.globalAlpha = 0.85;
    ctx.font = "600 28px Inter, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(p.label, x + 30, y + 48);
    ctx.globalAlpha = 1;
  });

  // Footer: notes (optional) + small BXKR tagline bottom-left
  if (opts.notes && opts.notes.trim()) {
    ctx.globalAlpha = 0.9;
    ctx.font = "400 30px Inter, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillStyle = TEXT;
    ctx.fillText(trimFit(ctx, opts.notes.trim(), 48, W - 96, 30), 48, H - 88);
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.75;
  ctx.font = "600 28px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillStyle = TEXT;
  ctx.fillText("BXKR • Train. Fuel. Repeat.", 48, H - 40);
  ctx.globalAlpha = 1;

  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  const dataUrl = canvas.toDataURL("image/png");
  return { blob, dataUrl };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function trimFit(ctx: CanvasRenderingContext2D, s: string, x: number, maxWidth: number, fontSize: number) {
  if (ctx.measureText(s).width <= maxWidth) return s;
  let out = s;
  while (out.length > 2 && ctx.measureText(out + "…").width > maxWidth) out = out.slice(0, -1);
  return out + "…";
}

async function shareViaSystem(blob: Blob, filename = "bxkr-story.png") {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if ((navigator as any).canShare?.({ files: [file] })) {
      await (navigator as any).share({ files: [file], title: "BXKR", text: "Train. Fuel. Repeat." });
      return true;
    }
  } catch {}
  return false;
}
function tryDeepLink(uri: string) {
  try { window.location.href = uri; } catch {}
}

export default function CompletedPelotonStylePage() {
  const router = useRouter();
  const { workout_id } = router.query as { workout_id?: string };

  const url =
    workout_id && typeof workout_id === "string"
      ? `/api/completions/last?workout_id=${encodeURIComponent(workout_id)}`
      : null;

  const { data } = useSWR<LastCompletion | { ok: boolean; last?: LastCompletion }>(url, fetcher, { revalidateOnFocus: false });

  const completion: LastCompletion | null = useMemo(() => {
    if (!data) return null;
    if ((data as any).ok && (data as any).last) return (data as any).last as LastCompletion;
    return data as LastCompletion;
  }, [data]);

  const iso = toISO(completion?.completed_date) || new Date().toISOString();
  const dateText = useMemo(
    () =>
      new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [iso]
  );

  const calories = completion?.calories_burned ?? null;
  const duration = pickDuration(completion);
  const rpe = completion?.rpe ?? (typeof completion?.rating === "number" ? completion?.rating : null);
  const difficulty = rpeToDifficulty(rpe);
  const weightUsed = heaviestWeight(completion);
  const notes = completion?.notes ?? null;

  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { dataUrl } = await renderShareImage({
        mode: "story",
        title: TITLE_TEXT,
        dateText,
        calories,
        weightUsed,
        duration,
        difficulty,
        notes,
        bgUrl: BG_URL,
        logoUrl: LOGO_URL,
      });
      if (alive) setPreviewUrl(dataUrl);
    })();
    return () => { alive = false; };
  }, [dateText, calories, weightUsed, duration, difficulty, notes]);

  async function download(mode: "story" | "square") {
    setBusy(true);
    try {
      const { blob } = await renderShareImage({
        mode,
        title: TITLE_TEXT,
        dateText,
        calories,
        weightUsed,
        duration,
        difficulty,
        notes,
        bgUrl: BG_URL,
        logoUrl: LOGO_URL,
      });
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `bxkr-${mode}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  }

  async function shareInstagram() {
    setBusy(true);
    try {
      const { blob } = await renderShareImage({
        mode: "story",
        title: TITLE_TEXT, dateText, calories, weightUsed, duration, difficulty, notes,
        bgUrl: BG_URL, logoUrl: LOGO_URL,
      });
      const shared = await shareViaSystem(blob, "bxkr-story.png");
      tryDeepLink("instagram://story-camera");
      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "bxkr-story.png"; a.click();
        URL.revokeObjectURL(url);
      }
    } finally { setBusy(false); }
  }

  async function shareFacebook() {
    setBusy(true);
    try {
      const { blob } = await renderShareImage({
        mode: "story",
        title: TITLE_TEXT, dateText, calories, weightUsed, duration, difficulty, notes,
        bgUrl: BG_URL, logoUrl: LOGO_URL,
      });
      const shared = await shareViaSystem(blob, "bxkr-story.png");
      tryDeepLink("fb://story-camera");
      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "bxkr-story.png"; a.click();
        URL.revokeObjectURL(url);
      }
    } finally { setBusy(false); }
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
        {/* Top bar */}
        <div className="d-flex align-items-center justify-content-between mb-3" style={{ gap: 8 }}>
          <Link href="/" className="btn btn-bxkr-outline" style={{ borderRadius: 24 }}>
            ← Back
          </Link>
          <h1 className="h5 m-0">Share • Completed</h1>
          <div />
        </div>

        {/* Live preview (story aspect) */}
        <section className="futuristic-card p-2 mb-3">
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              marginInline: "auto",
              borderRadius: 20,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 0 24px rgba(0,0,0,0.35)",
            }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Story preview" style={{ width: "100%", height: "auto", display: "block" }} />
            ) : (
              <div className="p-5 text-center text-dim small">Preparing preview…</div>
            )}
          </div>
          <div className="small text-dim text-center mt-2">Story preview (1080×1920)</div>
        </section>

        {/* Actions */}
        <section className="futuristic-card p-3 mb-3">
          <div className="d-flex flex-wrap align-items-center justify-content-center" style={{ gap: 10 }}>
            <button
              className="btn btn-sm"
              onClick={shareInstagram}
              disabled={busy}
              style={{
                borderRadius: 24,
                color: "#0a0a0c",
                background: `linear-gradient(90deg, ${ACCENT}, #ff7f32)`,
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
                background: `linear-gradient(90deg, ${ACCENT}, #ff7f32)`,
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

          <div className="text-center small text-dim mt-2">
            Tip: If sharing doesn’t open directly, the image downloads—choose it from your Stories camera.
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
