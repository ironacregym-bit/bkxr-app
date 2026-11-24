import React, { useEffect, useState } from "react";

const ACCENT = "#FF8A2A";

type Props = {
  open: boolean;
  onClose: () => void;
  userEmail: string;
  onSaved?: () => void; // optional callback after successful save (to let parent revalidate)
};

// Downscale to keep server-side 900 KB limit happy
async function imageFileToDataUrl(file: File, maxSize = 1400, quality = 0.82): Promise<string> {
  const img = document.createElement("img");
  const reader = new FileReader();
  const loadPromise = new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      if (!reader.result) return reject(new Error("Failed to read image"));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const { width, height } = img as HTMLImageElement;
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

export default function CreateCheckinModal({ open, onClose, userEmail, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  // Form fields (Option 2)
  const [weekDate, setWeekDate] = useState<string>(""); // YYYY-MM-DD
  const [weight, setWeight] = useState<string>("");
  const [bodyFatPct, setBodyFatPct] = useState<string>("");
  const [energy, setEnergy] = useState<string>("");
  const [stress, setStress] = useState<string>("");
  const [sleep, setSleep] = useState<string>("");
  const [calDiff, setCalDiff] = useState<string>("");
  const [goalsAchieved, setGoalsAchieved] = useState<boolean | null>(null);
  const [nextGoals, setNextGoals] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Photos
  const [photoFront, setPhotoFront] = useState<string | null>(null);
  const [photoSide, setPhotoSide] = useState<string | null>(null);
  const [photoBack, setPhotoBack] = useState<string | null>(null);

  useEffect(() => {
    if (open && !weekDate) {
      const today = new Date();
      const ymd = today.toISOString().slice(0, 10);
      setWeekDate(ymd);
    }
  }, [open, weekDate]);

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

  const canSubmit =
    open &&
    !saving &&
    userEmail &&
    weekDate &&
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setSaveErr(null);
    setSaveOk(null);
    try {
      const params = new URLSearchParams();
      params.set("email", String(userEmail));
      params.set("week", weekDate);

      const body: any = {
        user_email: userEmail,
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
        body.progress_photo_side = photoSide;   // singular (new)
        body.progress_photos_side = photoSide;  // plural (existing UI reads)
      }
      if (photoBack) {
        body.progress_photo_back = photoBack;   // singular (new)
        body.progress_photos_back = photoBack;  // plural (existing UI reads)
      }

      const res = await fetch(`/api/admin/members/checkins/create?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);

      setSaveOk("Check-in saved.");
      if (typeof onSaved === "function") onSaved();

      // clear non-date fields
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

  if (!open) return null;

  return (
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
        if (!saving) onClose();
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
            onClick={() => !saving && onClose()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="small text-dim">Save a weekly check‑in for this member</div>

        <form onSubmit={submit} className="mt-3">
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
              disabled={!canSubmit}
              className="btn"
              style={{
                borderRadius: 24,
                color: "#0a0a0c",
                background: canSubmit
                  ? `linear-gradient(90deg, ${ACCENT}, #ff7f32)`
                  : "linear-gradient(90deg, #777, #555)",
                boxShadow: canSubmit ? `0 0 0.5rem ${ACCENT}55, 0 0 1.25rem ${ACCENT}44` : "none",
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
              onClick={() => !saving && onClose()}
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
  );
}
