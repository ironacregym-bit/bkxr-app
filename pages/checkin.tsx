
// /pages/checkin.tsx
"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
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

// ---- Helpers aligned with your other pages ----
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

// Client-side image compression to keep data URLs small
async function compressImage(file: File, maxW = 1200, quality = 0.7): Promise<string> {
  const blobUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Canvas not available"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      URL.revokeObjectURL(blobUrl);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = blobUrl;
  });
}

type CheckInEntry = {
  id?: string;
  user_email?: string;
  date_completed?: string | number | Date;
  weekly_goals_achieved?: boolean;
  next_week_goals?: string;
  averge_hours_of_sleep?: string; // keep exact key as in your sample
  body_fat_pct?: string;
  energy_levels?: string;
  stress_levels?: string;
  calories_difficulty?: string;
  weight?: number;
  progress_photo_front?: string; // data URL
  progress_photo_side?: string;  // data URL
  progress_photo_back?: string;  // data URL
  notes?: string;
};

/** --- New: Reusable photo picker field with camera OR library + drop support --- */
function PhotoField({
  label,
  value,
  onChangeDataUrl,
  onClear,
}: {
  label: "Front" | "Side" | "Back";
  value: string;
  onChangeDataUrl: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 1200, 0.72);
      onChangeDataUrl(dataUrl);
    } catch {
      alert("Failed to process photo. Try a smaller image.");
    }
  }

  // "Choose from library": ensure capture is removed, then click
  function chooseFromLibrary() {
    const el = inputRef.current;
    if (!el) return;
    el.removeAttribute("capture");       // <- critical: allow gallery/library
    el.click();
  }

  // "Take photo": set capture to environment (rear camera), then click
  function takePhoto() {
    const el = inputRef.current;
    if (!el) return;
    el.setAttribute("capture", "environment");
    el.click();
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    handleFile(file);
  }

  // Drag-and-drop for desktop
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  return (
    <div className="glass-card p-2">
      <div className="fw-semibold mb-2">{label}</div>

      {/* Preview / Dropzone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: `1px dashed ${dragOver ? "#FF8A2A" : "rgba(255,255,255,0.25)"}`,
          borderRadius: 12,
          padding: 8,
          background: "rgba(255,255,255,0.03)",
          transition: "border-color .15s ease",
        }}
      >
        {value ? (
          <img src={value} alt={`${label} preview`} style={{ width: "100%", height: "auto", borderRadius: 8 }} />
        ) : (
          <div className="text-muted small" style={{ padding: "18px 8px" }}>
            Drop an image here (desktop) or use the buttons below.
          </div>
        )}
      </div>

      {/* Hidden input used by both buttons */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="form-control"
        style={{ display: "none" }}
        onChange={onInputChange}
      />

      <div className="d-flex gap-2 mt-2">
        <button type="button" className="btn btn-outline-light btn-sm" onClick={takePhoto} title="Open camera">
          <i className="fas fa-camera me-1" />
          Take photo
        </button>
        <button type="button" className="btn btn-outline-light btn-sm" onClick={chooseFromLibrary} title="Pick from library">
          <i className="fas fa-images me-1" />
          Choose from library
        </button>
        {value && (
          <button type="button" className="btn btn-outline-danger btn-sm ms-auto" onClick={onClear} title="Remove photo">
            Remove
          </button>
        )}
      </div>

      <small className="text-muted d-block mt-2">
        Photos are compressed on-device (JPEG ~72% quality, max 1200px wide) before upload.
      </small>
    </div>
  );
}

export default function CheckInPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // --- Read ?date=YYYY-MM-DD (from Progress "Edit" link) ---
  const urlDateParam = useMemo(() => {
    if (!router.isReady) return null;
    const raw = Array.isArray(router.query.date) ? router.query.date[0] : router.query.date;
    return typeof raw === "string" ? raw : null;
  }, [router.isReady, router.query.date]);

  // Validate/parse date param; fallback to "today" if missing/invalid.
  const selectedBaseDate = useMemo(() => {
    if (urlDateParam && /^\d{4}-\d{2}-\d{2}$/.test(urlDateParam)) {
      const d = new Date(urlDateParam + "T00:00:00");
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [urlDateParam]);

  // Compute the Friday of the selected week (your schema key)
  const selectedFriday = useMemo(() => fridayOfWeek(selectedBaseDate), [selectedBaseDate]);
  const selectedFridayYMD = formatYMD(selectedFriday);

  // Load the entry for the selected week
  const { data, mutate } = useSWR<{ entry?: CheckInEntry }>(
    `/api/checkins/weekly?week=${encodeURIComponent(selectedFridayYMD)}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );
  const alreadySubmitted = !!data?.entry;

  // -------- Form state --------
  const [notes, setNotes] = useState("");
  const [weeklyGoalsAchieved, setWeeklyGoalsAchieved] = useState<boolean>(false);
  const [nextWeekGoals, setNextWeekGoals] = useState<string>("");
  const [avgSleep, setAvgSleep] = useState<string>("7");
  const [bodyFatPct, setBodyFatPct] = useState<string>("");
  const [energyLevels, setEnergyLevels] = useState<string>("7");
  const [stressLevels, setStressLevels] = useState<string>("4");
  const [caloriesDiff, setCaloriesDiff] = useState<string>("6");
  const [weight, setWeight] = useState<string>("");

  // Photos
  const [photoFront, setPhotoFront] = useState<string>("");
  const [photoSide, setPhotoSide] = useState<string>("");
  const [photoBack, setPhotoBack] = useState<string>("");

  // Optional: prefill if there's an existing entry
  useEffect(() => {
    if (!data?.entry) return;
    const e = data.entry;
    setNotes(e.notes || "");
    setWeeklyGoalsAchieved(Boolean(e.weekly_goals_achieved));
    setNextWeekGoals(e.next_week_goals || "");
    setAvgSleep(e.averge_hours_of_sleep || "7");
    setBodyFatPct(e.body_fat_pct || "");
    setEnergyLevels(e.energy_levels || "7");
    setStressLevels(e.stress_levels || "4");
    setCaloriesDiff(e.calories_difficulty || "6");
    setWeight(typeof e.weight === "number" && Number.isFinite(e.weight) ? String(e.weight) : "");
    if (e.progress_photo_front) setPhotoFront(e.progress_photo_front);
    if (e.progress_photo_side) setPhotoSide(e.progress_photo_side);
    if (e.progress_photo_back) setPhotoBack(e.progress_photo_back);
  }, [data?.entry]);

  async function submitCheckIn(e: React.FormEvent) {
    e.preventDefault();
    const payload: CheckInEntry = {
      user_email: session?.user?.email || undefined,
      date_completed: new Date().toISOString(),
      weekly_goals_achieved: weeklyGoalsAchieved,
      next_week_goals: nextWeekGoals || "",
      averge_hours_of_sleep: avgSleep || "",
      body_fat_pct: bodyFatPct || "",
      energy_levels: energyLevels || "",
      stress_levels: stressLevels || "",
      calories_difficulty: caloriesDiff || "",
      weight: weight ? Number(weight) : undefined,
      notes: notes || "",
      progress_photo_front: photoFront || "",
      progress_photo_side: photoSide || "",
      progress_photo_back: photoBack || "",
    };

    try {
      const res = await fetch(
        `/api/checkins/weekly?week=${encodeURIComponent(selectedFridayYMD)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || "Failed to submit check-in");
        return;
      }
      mutate(); // refresh SWR cache
    } catch (err) {
      console.error(err);
      alert("Network error submitting check-in");
    }
  }

  return (
    <>
      <Head>
        <title>Weekly Check‑in • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: "70px",
          background: "linear-gradient(135deg,#1a1a1a,#2c2c2c)",
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
            Week’s Friday: <strong>{selectedFridayYMD}</strong>
          </div>
        </div>

        <h2 className="mb-3" style={{ fontWeight: 700, fontSize: "1.6rem" }}>
          Weekly Check‑in
        </h2>

        {/* Status Banner */}
        {alreadySubmitted ? (
          <BxkrBanner
            title="All set"
            message={`Your weekly check‑in is already submitted for ${selectedFridayYMD}.`}
            href="#checkin-form"
            iconLeft="fas fa-clipboard-check"
            accentColor="#64c37a"
            buttonText="View / Update"
          />
        ) : (
          <BxkrBanner
            title="Check‑in due"
            message={`Submit your weekly check‑in for ${selectedFridayYMD}.`}
            href="#checkin-form"
            iconLeft="fas fa-clipboard-list"
            accentColor="#FF8A2A"
            buttonText="Jump to Form"
          />
        )}

        {/* Form Card */}
        <div id="checkin-form" className="futuristic-card p-3 mt-3">
          <form onSubmit={submitCheckIn}>
            {/* Top row: quick sliders */}
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label">Average sleep (hours)</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="form-control"
                  value={avgSleep}
                  onChange={(e) => setAvgSleep(e.target.value)}
                  placeholder="e.g., 7"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.15)" }}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Body fat %</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="form-control"
                  value={bodyFatPct}
                  onChange={(e) => setBodyFatPct(e.target.value)}
                  placeholder="e.g., 14.9"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.15)" }}
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label">Energy (1–10)</label>
                <input type="range" min={1} max={10} value={Number(energyLevels)} onChange={(e) => setEnergyLevels(e.target.value)} className="form-range" />
                <small style={{ opacity: 0.75 }}>{energyLevels}</small>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label">Stress (1–10)</label>
                <input type="range" min={1} max={10} value={Number(stressLevels)} onChange={(e) => setStressLevels(e.target.value)} className="form-range" />
                <small style={{ opacity: 0.75 }}>{stressLevels}</small>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label">Calories difficulty (1–10)</label>
                <input type="range" min={1} max={10} value={Number(caloriesDiff)} onChange={(e) => setCaloriesDiff(e.target.value)} className="form-range" />
                <small style={{ opacity: 0.75 }}>{caloriesDiff}</small>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label">Weight (kg)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="form-control"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g., 75.4"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.15)" }}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label">Weekly goals achieved?</label>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="goalsAchieved" checked={weeklyGoalsAchieved} onChange={(e) => setWeeklyGoalsAchieved(e.target.checked)} />
                  <label className="form-check-label" htmlFor="goalsAchieved">
                    {weeklyGoalsAchieved ? "Yes" : "No"}
                  </label>
                </div>
              </div>

              <div className="col-12">
                <label className="form-label">Next week goals</label>
                <input
                  className="form-control"
                  value={nextWeekGoals}
                  onChange={(e) => setNextWeekGoals(e.target.value)}
                  placeholder='e.g., "3 BXKR Workouts"'
                  style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.15)" }}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mt-3">
              <label className="form-label">Notes (optional)</label>
              <textarea
                className="form-control"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did your week go? Anything notable?"
                style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.15)" }}
              />
            </div>

            {/* Progress Photos (updated with PhotoField) */}
            <div className="mt-3">
              <div className="fw-bold mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 6 }}>
                Progress Photos
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <PhotoField
                    label="Front"
                    value={photoFront}
                    onChangeDataUrl={(url) => setPhotoFront(url)}
                    onClear={() => setPhotoFront("")}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <PhotoField
                    label="Side"
                    value={photoSide}
                    onChangeDataUrl={(url) => setPhotoSide(url)}
                    onClear={() => setPhotoSide("")}
                  />
                </div>

                <div className="col-12 col-md-4">
                  <PhotoField
                    label="Back"
                    value={photoBack}
                    onChangeDataUrl={(url) => setPhotoBack(url)}
                    onClear={() => setPhotoBack("")}
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="mt-3">
              <button type="submit" className="bxkr-btn">
                <i className="fas fa-check me-2" />
                {alreadySubmitted ? "Update Check‑in" : "Submit Check‑in"}
              </button>
            </div>
          </form>
        </div>

        {/* Previous submission snapshot (if any) */}
        {alreadySubmitted && data?.entry && (
          <div className="futuristic-card p-3 mt-3">
            <div className="fw-bold mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 6 }}>
              Submission for {selectedFridayYMD}
            </div>
            <div className="row g-3">
              <div className="col-12 col-md-3">
                <small className="text-muted">Sleep</small>
                <div>{data.entry.averge_hours_of_sleep || "-"}</div>
              </div>
              <div className="col-12 col-md-3">
                <small className="text-muted">Body fat %</small>
                <div>{data.entry.body_fat_pct || "-"}</div>
              </div>
              <div className="col-12 col-md-3">
                <small className="text-muted">Energy</small>
                <div>{data.entry.energy_levels || "-"}</div>
              </div>
              <div className="col-12 col-md-3">
                <small className="text-muted">Stress</small>
                <div>{data.entry.stress_levels || "-"}</div>
              </div>
              <div className="col-12 col-md-3">
                <small className="text-muted">Calories difficulty</small>
                <div>{data.entry.calories_difficulty || "-"}</div>
              </div>
              <div className="col-12 col-md-3">
                <small className="text-muted">Weight (kg)</small>
                <div>{data.entry.weight ?? "-"}</div>
              </div>
              <div className="col-12 col-md-6">
                <small className="text-muted">Goals achieved</small>
                <div>{String(data.entry.weekly_goals_achieved ?? false)}</div>
              </div>
              <div className="col-12">
                <small className="text-muted">Next week goals</small>
                <div>{data.entry.next_week_goals || "-"}</div>
              </div>
              <div className="col-12">
                <small className="text-muted">Notes</small>
                <div>{data.entry.notes || "-"}</div>
              </div>
            </div>
            <div className="row g-3 mt-2">
              {data.entry.progress_photo_front && (
                <div className="col-12 col-md-4">
                  <div className="glass-card p-2">
                    <div className="fw-semibold mb-2">Front</div>
                    <img src={data.entry.progress_photo_front} alt="Front" style={{ width: "100%", height: "auto", borderRadius: 12 }} />
                  </div>
                </div>
              )}
              {data.entry.progress_photo_side && (
                <div className="col-12 col-md-4">
                  <div className="glass-card p-2">
                    <div className="fw-semibold mb-2">Side</div>
                    <img src={data.entry.progress_photo_side} alt="Side" style={{ width: "100%", height: "auto", borderRadius: 12 }} />
                  </div>
                </div>
              )}
              {data.entry.progress_photo_back && (
                <div className="col-12 col-md-4">
                  <div className="glass-card p-2">
                    <div className="fw-semibold mb-2">Back</div>
                    <img src={data.entry.progress_photo_back} alt="Back" style={{ width: "100%", height: "auto", borderRadius: 12 }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
