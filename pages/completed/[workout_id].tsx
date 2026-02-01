import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useMemo, useRef, useState } from "react";
import BottomNav from "../../components/BottomNav";

const ACCENT = "#FF8A2A";
const DARK = "#0a0a0c";
const FG = "#e6eef9";

type CompletionSet = {
  exercise_id: string;
  set: number;
  weight: number | null;
  reps: number | null;
};

type LastCompletion = {
  workout_id?: string;
  workout_name?: string; // optional if API returns it
  completed_date?: any;
  calories_burned?: number | null;
  duration_minutes?: number | null; // gym path
  duration?: number | null;         // legacy path
  rpe?: number | null;
  rating?: number | null;           // legacy rating
  notes?: string | null;
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

// Render-safe string (fallback)
function nice(s: any, d = "—") {
  const v = s == null ? "" : String(s);
  return v.trim() ? v : d;
}

function rpeToDifficulty(rpe?: number | null): "Easy" | "Medium" | "Hard" | "—" {
  if (rpe == null || Number.isNaN(rpe)) return "—";
  if (rpe <= 4) return "Easy";
  if (rpe <= 7) return "Medium";
  return "Hard";
}

// Convert dumb exercise IDs to readable if no names present
function titleCaseId(id: string) {
  return id.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (m) => m.toUpperCase());
}

// Build highlights: per exercise -> heaviest (weight desc, then reps desc)
function buildHighlights(sets: CompletionSet[] | undefined) {
  if (!Array.isArray(sets) || sets.length === 0) return [];
  const byEx: Record<string, CompletionSet[]> = {};
  for (const s of sets) {
    if (!s.exercise_id) continue;
    if (!byEx[s.exercise_id]) byEx[s.exercise_id] = [];
    byEx[s.exercise_id].push(s);
  }
  const rows = Object.entries(byEx).map(([ex, arr]) => {
    const best = [...arr].sort((a, b) => {
      const wa = a.weight ?? 0, wb = b.weight ?? 0;
      if (wb !== wa) return wb - wa;
      const ra = a.reps ?? 0, rb = b.reps ?? 0;
      return rb - ra;
    })[0];
    return {
      exercise_id: ex,
      label: titleCaseId(ex),
      weight: best.weight ?? null,
      reps: best.reps ?? null,
    };
  });
  // Keep top 6 to avoid clutter
  return rows.slice(0, 6);
}

// Build an SVG story/square card and return SVG string
function buildShareSVG(opts: {
  mode: "story" | "square";
  logoUrl?: string;
  title: string;
  subtitle?: string;
  dateText?: string;
  calories?: number | null;
  duration?: number | null;
  rpe?: number | null;
  highlights: Array<{ label: string; weight: number | null; reps: number | null }>;
  notes?: string | null;
}) {
  const width = 1080;
  const height = opts.mode === "story" ? 1920 : 1080;
  const pad = 64;

  const bgGrad = `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b0f14"/>
        <stop offset="100%" stop-color="#0a0a0c"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${ACCENT}"/>
        <stop offset="100%" stop-color="#ff7f32"/>
      </linearGradient>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur"/>
        <feBlend in="SourceGraphic" in2="blur" mode="normal"/>
      </filter>
    </defs>
  `;

  const cal = opts.calories != null ? Math.round(opts.calories) : null;
  const dur = opts.duration != null ? Math.round(opts.duration) : null;
  const diff = rpeToDifficulty(opts.rpe);

  // Highlights rows as <tspan>
  const highlightLines = opts.highlights.map((h, i) => {
    const w = h.weight != null ? `${h.weight}kg` : "-";
    const r = h.reps != null ? `${h.reps} reps` : "-";
    return `<tspan x="${pad}" dy="${i === 0 ? 0 : 58}">${h.label} • ${w} × ${r}</tspan>`;
  }).join("");

  const notesBlock = opts.notes?.trim()
    ? `<text x="${pad}" y="${height - pad - 64}" fill="${FG}" font-size="34" opacity="0.75">
         ${escapeXml(opts.notes.trim()).slice(0, 220)}
       </text>`
    : "";

  const logo = opts.logoUrl
    ? `<image href="${opts.logoUrl}" x="${width - pad - 160}" y="${pad}" width="160" height="160" preserveAspectRatio="xMidYMid meet" opacity="0.96"/>`
    : `<g transform="translate(${width - pad - 200}, ${pad + 20})">
         <rect width="200" height="80" rx="16" fill="url(#accent)" />
         <text x="100" y="52" font-size="40" text-anchor="middle" font-weight="900" fill="#0b0f14">BXKR</text>
       </g>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${bgGrad}
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>
  <!-- Ambient accent glows -->
  <circle cx="${width * 0.2}" cy="${height * 0.1}" r="220" fill="${ACCENT}" opacity="0.08" filter="url(#soft)"/>
  <circle cx="${width * 0.85}" cy="${height * 0.85}" r="260" fill="${ACCENT}" opacity="0.07" filter="url(#soft)"/>

  <!-- Header -->
  <text x="${pad}" y="${pad + 64}" fill="${FG}" font-size="56" font-weight="800">${escapeXml(opts.title)}</text>
  <text x="${pad}" y="${pad + 120}" fill="${FG}" opacity="0.7" font-size="36">${escapeXml(opts.subtitle || "")}</text>
  ${opts.dateText ? `<text x="${pad}" y="${pad + 168}" fill="${FG}" opacity="0.6" font-size="30">${escapeXml(opts.dateText)}</text>` : ""}

  ${logo}

  <!-- Stats pill row -->
  <g transform="translate(${pad}, ${pad + 230})">
    ${pill("Calories", cal != null ? `${cal} kcal` : "—")}
    <g transform="translate(360, 0)">${pill("Duration", dur != null ? `${dur} min` : "—")}</g>
    <g transform="translate(720, 0)">${pill("Difficulty", diff)}</g>
  </g>

  <!-- Highlights -->
  <text x="${pad}" y="${pad + 370}" fill="${FG}" font-size="34" opacity="0.8">Top Lifts</text>
  <rect x="${pad}" y="${pad + 392}" width="${width - pad * 2}" height="${opts.mode === "story" ? 640 : 420}" rx="16" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)"/>
  <text x="${pad}" y="${pad + 452}" fill="${FG}" font-size="44" font-weight="700" xml:space="preserve">
    ${highlightLines || "<tspan x='${pad}'>No sets logged</tspan>"}
  </text>

  <!-- Footer -->
  ${notesBlock}
  <text x="${pad}" y="${height - pad}" fill="${FG}" opacity="0.6" font-size="28">#BXKR • Train. Fuel. Repeat.</text>
</svg>`;
}

function pill(label: string, value: string) {
  return `
  <g>
    <rect x="0" y="0" width="320" height="100" rx="50" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)"/>
    <text x="160" y="42" text-anchor="middle" fill="#cbd5e1" font-size="26">${escapeXml(label)}</text>
    <text x="160" y="76" text-anchor="middle" fill="#ffffff" font-size="32" font-weight="800">${escapeXml(value)}</text>
  </g>`;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function downloadSvgAsPng(svg: string, filename: string, w: number, h: number) {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // background
    ctx.fillStyle = DARK;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.download = filename;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

export default function CompletedSharePage() {
  const router = useRouter();
  const { workout_id } = router.query as { workout_id?: string };

  const url =
    workout_id && typeof workout_id === "string"
      ? `/api/completions/last?workout_id=${encodeURIComponent(workout_id)}`
      : null;

  const { data } = useSWR<LastCompletion | { ok: boolean; last?: LastCompletion }>(url, fetcher, {
    revalidateOnFocus: false,
  });

  // The /last endpoint could return either the object or {ok,last}
  const last = useMemo<LastCompletion | null>(() => {
    if (!data) return null;
    if ("ok" in (data as any) && (data as any).ok && (data as any).last) return (data as any).last as LastCompletion;
    return data as LastCompletion;
  }, [data]);

  // Optional title override: ?title=Leg%20Day
  const qpTitle = typeof router.query.title === "string" ? router.query.title : "";
  const title = nice(qpTitle || last?.workout_name || "Workout Complete", "Workout Complete");
  const dateText = useMemo(() => {
    const iso = toISO(last?.completed_date) || new Date().toISOString();
    const d = new Date(iso);
    return d.toLocaleString(undefined, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }, [last?.completed_date]);

  const calories = last?.calories_burned ?? null;
  const duration =
    last?.duration_minutes != null
      ? last?.duration_minutes
      : last?.duration != null
      ? last?.duration
      : null;
  const rpe = last?.rpe ?? (typeof last?.rating === "number" ? last?.rating : null);
  const notes = last?.notes ?? null;

  const highlights = useMemo(
    () => buildHighlights(last?.sets),
    [last?.sets]
  );

  // Placeholder logo (drop your file here later)
  const logoUrl = "/brand/bxkr-logo.png"; // put your logo at public/brand/bxkr-logo.png

  const storyRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  async function download(mode: "story" | "square") {
    try {
      setBusy(true);
      const svg = buildShareSVG({
        mode,
        logoUrl,
        title,
        subtitle: "Personal Bests & Highlights",
        dateText,
        calories,
        duration,
        rpe,
        notes,
        highlights,
      });
      const [w, h] = mode === "story" ? [1080, 1920] : [1080, 1080];
      await downloadSvgAsPng(svg, `bxkr-${mode}-${new Date().toISOString().slice(0, 10)}.png`, w, h);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>{`${title} • Share • BXKR`}</title>
        {/* Basic Open Graph (static placeholder) */}
        <meta property="og:title" content={`${title} • BXKR`} />
        <meta property="og:description" content="I just completed a BXKR workout. Train. Fuel. Repeat." />
        <meta property="og:image" content="/og/share-placeholder.png" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="d-flex align-items-center justify-content-between mb-3" style={{ gap: 8 }}>
          <Link href="/" className="btn btn-outline-secondary" style={{ borderRadius: 24 }}>
            ← Back
          </Link>
          <h1 className="h5 m-0">Share • Completed</h1>
          <div />
        </div>

        {/* Preview (HTML card approximating the SVG styling) */}
        <section ref={storyRef} className="futuristic-card p-3 mb-3">
          <div className="d-flex align-items-start justify-content-between">
            <div>
              <div className="fw-bold" style={{ fontSize: 22 }}>{title}</div>
              <div className="text-dim" style={{ fontSize: 13 }}>{dateText}</div>
            </div>
            <div
              className="d-flex align-items-center justify-content-center"
              style={{
                width: 96,
                height: 48,
                borderRadius: 12,
                background: `linear-gradient(90deg, ${ACCENT}, #ff7f32)`,
                color: "#0b0f14",
                fontWeight: 900,
              }}
            >
              BXKR
            </div>
          </div>

          <div className="row g-2 mt-2">
            <div className="col-4">
              <div className="p-2 text-center" style={{ borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
                <div className="text-dim" style={{ fontSize: 12 }}>Calories</div>
                <div className="fw-bold" style={{ fontSize: 18 }}>{calories != null ? Math.round(calories) : "—"} kcal</div>
              </div>
            </div>
            <div className="col-4">
              <div className="p-2 text-center" style={{ borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
                <div className="text-dim" style={{ fontSize: 12 }}>Duration</div>
                <div className="fw-bold" style={{ fontSize: 18 }}>{duration != null ? Math.round(duration) : "—"} min</div>
              </div>
            </div>
            <div className="col-4">
              <div className="p-2 text-center" style={{ borderRadius: 12, background: "rgba(255,255,255,0.06)" }}>
                <div className="text-dim" style={{ fontSize: 12 }}>Difficulty</div>
                <div className="fw-bold" style={{ fontSize: 18 }}>{rpeToDifficulty(rpe ?? null)}</div>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-dim" style={{ fontSize: 14 }}>Top Lifts</div>
            <div className="p-2" style={{ borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}>
              {!highlights.length ? (
                <div className="text-dim small">No sets logged</div>
              ) : (
                <ul className="m-0" style={{ listStyle: "none", padding: 0 }}>
                  {highlights.map((h, i) => (
                    <li key={i} className="d-flex align-items-center justify-content-between" style={{ padding: "6px 0" }}>
                      <span className="fw-semibold">{h.label}</span>
                      <span className="text-dim small">
                        {h.weight != null ? `${h.weight}kg` : "-"} × {h.reps != null ? h.reps : "-"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {notes?.trim() ? (
            <div className="mt-2">
              <div className="text-dim small">Notes</div>
              <div className="small">{notes.trim()}</div>
            </div>
          ) : null}
        </section>

        {/* Actions */}
        <div className="d-flex flex-wrap align-items-center" style={{ gap: 8 }}>
          <button
            className="btn btn-sm"
            onClick={() => download("story")}
            disabled={busy}
            style={{
              borderRadius: 24,
              color: "#0a0a0c",
              background: `linear-gradient(90deg, ${ACCENT}, #ff7f32)`,
              border: "none",
            }}
          >
            {busy ? "Preparing…" : "Download Story (1080×1920)"}
          </button>
          <button
            className="btn btn-sm btn-bxkr-outline"
            onClick={() => download("square")}
            disabled={busy}
            style={{ borderRadius: 24 }}
          >
            {busy ? "Preparing…" : "Download Square (1080×1080)"}
          </button>
          <span className="text-dim small ms-1">Tip: Post to your story or feed and tag <strong>@BXKR</strong> 💥</span>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
