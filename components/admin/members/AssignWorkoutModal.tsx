import React, { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const ACCENT = "#FF8A2A";
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"] as const;
type DayName = typeof DAYS[number];

type WorkoutListItem = {
  workout_id: string;
  workout_name: string;
  focus?: string | null;
  visibility: "global" | "private";
  owner_email?: string | null;
};

type AssignWorkoutModalProps = {
  open: boolean;
  onClose: () => void;
  userEmail: string;                 // target member email
  onAssigned?: (assignmentId: string) => void; // optional callback on success
};

const fetcher = (u: string) =>
  fetch(u).then(async (r) => {
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(t || `HTTP ${r.status}`);
    }
    return r.json();
  });

export default function AssignWorkoutModal({
  open,
  onClose,
  userEmail,
  onAssigned,
}: AssignWorkoutModalProps) {
  // SWR key is null when closed (no fetch), hook remains top-level (hydration-safe)
  const workoutsKey = open ? "/api/admin/workouts/list?limit=100" : null;
  const { data: workoutsList, isValidating: loadingWorkoutsList, error: wlErr } =
    useSWR<{ items: WorkoutListItem[]; nextCursor?: string | null }>(workoutsKey, fetcher, {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      shouldRetryOnError: false,
    });

  const [form, setForm] = useState<{
    workout_id: string;
    recurring_day: DayName;
    start_date: string; // YYYY-MM-DD
    end_date: string;   // YYYY-MM-DD
    note?: string;
  }>({
    workout_id: "",
    recurring_day: "Monday",
    start_date: "",
    end_date: "",
    note: "",
  });

  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Prefill dates when opened
  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const ymd = today.toISOString().slice(0, 10);
    setForm((f) => ({
      ...f,
      start_date: f.start_date || ymd,
      end_date: f.end_date || ymd,
    }));
  }, [open]);

  const items = useMemo(() => workoutsList?.items ?? [], [workoutsList]);

  const canSubmit =
    open &&
    !saving &&
    userEmail &&
    form.workout_id &&
    form.start_date &&
    form.end_date &&
    DAYS.includes(form.recurring_day);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErrMsg(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/admin/members/workouts/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_email: userEmail,
          workout_id: form.workout_id,
          recurring_day: form.recurring_day,
          start_date: form.start_date, // YYYY-MM-DD allowed
          end_date: form.end_date,
          note: form.note || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);

      setOkMsg("Assigned ✅");
      if (typeof onAssigned === "function" && json?.assignment_id) {
        onAssigned(json.assignment_id);
      }
      // Keep modal open for multiple assigns; clear selection only
      setForm((f) => ({ ...f, workout_id: "", note: "" }));
    } catch (err: any) {
      setErrMsg(err?.message || "Failed to assign workout");
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
          <h5 className="mb-0">Assign workout</h5>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => !saving && onClose()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="small text-dim">
          Assign a recurring gym workout to <span style={{ color: ACCENT }}>{userEmail}</span>
        </div>

        <form onSubmit={onSubmit} className="mt-3">
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">Workout</label>
              {loadingWorkoutsList ? (
                <div className="text-dim">Loading workouts…</div>
              ) : wlErr ? (
                <div className="text-danger small">Unable to load workouts.</div>
              ) : (
                <select
                  className="form-select"
                  value={form.workout_id}
                  onChange={(e) => setForm((f) => ({ ...f, workout_id: e.target.value }))}
                  required
                >
                  <option value="">— Select —</option>
                  {items.map((w) => (
                    <option key={w.workout_id} value={w.workout_id}>
                      {w.workout_name}
                      {w.focus ? ` • ${w.focus}` : ""}
                      {w.visibility === "private" ? " • Private" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label">Recurring day</label>
              <select
                className="form-select"
                value={form.recurring_day}
                onChange={(e) => setForm((f) => ({ ...f, recurring_day: e.target.value as DayName }))}
                required
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-4">
              <label className="form-label">Start date</label>
              <input
                className="form-control"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                required
              />
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label">End date</label>
              <input
                className="form-control"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                required
              />
            </div>

            <div className="col-12">
              <label className="form-label">Note (optional)</label>
              <input
                className="form-control"
                value={form.note || ""}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g., Ramp week adjustments"
              />
            </div>
          </div>

          {errMsg && (
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
              {errMsg}
            </div>
          )}
          {okMsg && (
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
              {okMsg}
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
              {saving ? "Assigning…" : "Assign workout"}
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
      </div>
    </div>
  );
}
