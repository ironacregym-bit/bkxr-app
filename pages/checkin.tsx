
// /pages/checkin.tsx
"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { getSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import useSWR from "swr";
import { useMemo, useRef, useState } from "react";
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
    img.onerror = (e) => {
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

export default function CheckInPage() {
  const { data: session } = useSession();
  const today = new Date();
  const thisFriday = useMemo(() => fridayOfWeek(today), [today]);
  const thisFridayYMD = formatYMD(thisFriday);

  const { data, mutate } = useSWR<{ entry?: CheckInEntry }>(
    `/api/checkins/weekly?week=${encodeURIComponent(formatYMD(today))}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );
  const alreadySubmitted = !!data?.entry;

  // Form state (maps to your check_ins fields)
  const [notes, setNotes] = useState("");
  const [weeklyGoalsAchieved, setWeeklyGoalsAchieved] = useState<boolean>(false);
  const [nextWeekGoals, setNextWeekGoals] = useState<string>("");
  const [avgSleep, setAvgSleep] = useState<string>("7"); // string to match your sample
  const [bodyFatPct, setBodyFatPct] = useState<string>("");
  const [energyLevels, setEnergyLevels] = useState<string>("7");
  const [stressLevels, setStressLevels] = useState<string>("4");
  const [caloriesDiff, setCaloriesDiff] = useState<string>("6");
  const [weight, setWeight] = useState<string>("");

  // Photos + refs for reset
  const [photoFront, setPhotoFront] = useState<string>("");
  const [photoSide, setPhotoSide] = useState<string>("");
  const [photoBack, setPhotoBack] = useState<string>("");
  const frontRef = useRef<HTMLInputElement>(null);
  const sideRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  async function onPickPhoto(slot: "front" | "side" | "back", file?: File) {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 1200, 0.72);
      if (slot === "front") setPhotoFront(dataUrl);
      if (slot === "side") setPhotoSide(dataUrl);
      if (slot === "back") setPhotoBack(dataUrl);
    } catch (e) {
      alert("Failed to process photo. Try a smaller image.");
    }
  }

  function clearPhoto(slot: "front" | "side" | "back") {
    if (slot === "front") {
      setPhotoFront("");
      if (frontRef.current) frontRef.current.value = "";
    }
    if (slot === "side") {
      setPhotoSide("");
      if (sideRef.current) sideRef.current.value = "";
    }
    if (slot === "back") {
      setPhotoBack("");
      if (backRef.current) backRef.current.value = "";
    }
  }

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
        `/api/checkins/weekly?week=${encodeURIComponent(formatYMD(today))}`,
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
      // reset form
      setNotes("");
      setWeeklyGoalsAchieved(false);
      setNextWeekGoals("");
      setAvgSleep("7");
      setBodyFatPct("");
      setEnergyLevels("7");
      setStressLevels("4");
      setCaloriesDiff("6");
      setWeight("");
      clearPhoto("front");
      clearPhoto("side");
      clearPhoto("back");
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
            href="#checkin-form"
            iconLeft="fas fa-clipboard-check"
            accentColor="#64c37a"
            buttonText="View / Update"
          />
        ) : (
          <BxkrBanner
            title="Check‑in due"
            message="Submit your weekly check‑in for this week."
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
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={Number(energyLevels)}
                  onChange={(e) => setEnergyLevels(e.target.value)}
                  className="form-range"
                />
                <small style={{ opacity: 0.75 }}>{energyLevels}</small>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label">Stress (1–10)</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={Number(stressLevels)}
                  onChange={(e) => setStressLevels(e.target.value)}
                  className="form-range"
                />
                <small style={{ opacity: 0.75 }}>{stressLevels}</small>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label">Calories difficulty (1–10)</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={Number(caloriesDiff)}
                  onChange={(e) => setCaloriesDiff(e.target.value)}
                  className="form-range"
                />
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
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="goalsAchieved"
                    checked={weeklyGoalsAchieved}
                    onChange={(e) => setWeeklyGoalsAchieved(e.target.checked)}
                  />
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

            {/* Progress Photos */}
            <div className="mt-3">
              <div className="fw-bold mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 6 }}>
                Progress Photos
              </div>

              <div className="row g-3">
                {/* Front */}
                <div className="col-12 col-md-4">
                  <div className="glass-card p-2">
                    <div className="fw-semibold mb-2">Front</div>
                    {photoFront ? (
                      <div className="mb-2" style={{ borderRadius: 12, overflow: "hidden" }}>
                        <img src={photoFront} alt="Front preview" style={{ width: "100%", height: "auto" }} />
                      </div>
                    ) : (
                      <div className="text-muted mb-2">No photo yet</div>
                    )}
                    <input
                      ref={frontRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="form-control"
                      onChange={(e) => onPickPhoto("front", e.target.files?.[0])}
                    />
                    {photoFront && (
                      <button type="button" className="btn btn-outline-light btn-sm mt-2" style={{ borderRadius: 24 }} onClick={() => clearPhoto("front")}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Side */}
                <div className="col-12 col-md-4">
                  <div className="glass-card p-2">
                    <div className="fw-semibold mb-2">Side</div>
                    {photoSide ? (
                      <div className="mb-2" style={{ borderRadius: 12, overflow: "hidden" }}>
                        <img src={photoSide} alt="Side preview" style={{ width: "100%", height: "auto" }} />
                      </div>
                    ) : (
                      <div className="text-muted mb-2">No photo yet</div>
                    )}
                    <input
                      ref={sideRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="form-control"
                      onChange={(e) => onPickPhoto("side", e.target.files?.[0])}
                    />
                    {photoSide && (
                      <button type="button" className="btn btn-outline-light btn-sm mt-2" style={{ borderRadius: 24 }} onClick={() => clearPhoto("side")}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Back */}
                <div className="col-12 col-md-4">
                  <div className="glass-card p-2">
                    <div className="fw-semibold mb-2">Back</div>
                    {photoBack ? (
                      <div className="mb-2" style={{ borderRadius: 12, overflow: "hidden" }}>
                        <img src={photoBack} alt="Back preview" style={{ width: "100%", height: "auto" }} />
                      </div>
                    ) : (
                      <div className="text-muted mb-2">No photo yet</div>
                    )}
                    <input
                      ref={backRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="form-control"
                      onChange={(e) => onPickPhoto("back", e.target.files?.[0])}
                    />
                    {photoBack && (
                      <button type="button" className="btn btn-outline-light btn-sm mt-2" style={{ borderRadius: 24 }} onClick={() => clearPhoto("back")}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <small className="text-muted d-block mt-2">
                Tip: Photos are compressed on-device (JPEG ~72% quality, max 1200px wide) and stored as data URLs to keep uploads fast.
              </small>
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
              This week’s submission
            </div>
            <div className="row g-3">
              <div className="col-12 col-md-3"><small className="text-muted">Sleep</small><div>{data.entry.averge_hours_of_sleep || "-"}</div></div>
              <div className="col-12 col-md-3"><small className="text-muted">Body fat %</small><div>{data.entry.body_fat_pct || "-"}</div></div>
              <div className="col-12 col-md-3"><small className="text-muted">Energy</small><div>{data.entry.energy_levels || "-"}</div></div>
              <div className="col-12 col-md-3"><small className="text-muted">Stress</small><div>{data.entry.stress_levels || "-"}</div></div>
              <div className="col-12 col-md-3"><small className="text-muted">Calories difficulty</small><div>{data.entry.calories_difficulty || "-"}</div></div>
              <div className="col-12 col-md-3"><small className="text-muted">Weight (kg)</small><div>{data.entry.weight ?? "-"}</div></div>
              <div className="col-12 col-md-6"><small className="text-muted">Goals achieved</small><div>{String(data.entry.weekly_goals_achieved ?? false)}</div></div>
              <div className="col-12"><small className="text-muted">Next week goals</small><div>{data.entry.next_week_goals || "-"}</div></div>
              <div className="col-12"><small className="text-muted">Notes</small><div>{data.entry.notes || "-"}</div></div>
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

      <Bottom      <BottomNav />
    </>
  );
}
