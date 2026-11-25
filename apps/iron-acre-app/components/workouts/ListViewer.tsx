"use client";

import { useState } from "react";
import TechniqueChips, { BoxingAction } from "./TechniqueChips";
import ModalMedia from "./ModalMedia";
import KbRoundTracker from "./KbRoundTracker";
import { KbTrackingController } from "../../components/hooks/useKbTracking";

type KBStyle = "EMOM" | "AMRAP" | "LADDER";

type ExerciseItemOut = {
  item_id: string;
  type: "Boxing" | "Kettlebell";
  style?: KBStyle | "Combo";
  order: number;
  duration_s?: number;
  combo?: { name?: string; actions: BoxingAction[]; notes?: string };
  exercise_id?: string;
  reps?: string;
  time_s?: number;
  weight_kg?: number;
  tempo?: string;
  rest_s?: number;
};

type RoundOut = {
  round_id: string;
  name: string;
  order: number;
  category: "Boxing" | "Kettlebell";
  style?: KBStyle; // KB style; for boxing treat this as type (Basics/Speed/…)
  duration_s?: number;
  items: ExerciseItemOut[];
};

// Fix for Firestore gif_url containing "public/"
function fixGifUrl(u?: string) {
  if (!u) return u;
  if (u.startsWith("public/")) return "/" + u.replace(/^public\//, "");
  return u;
}

export default function ListViewer({
  boxingRounds,
  kbRounds,
  exerciseNameById,
  techVideoByCode,
  gifByExerciseId,
  videoByExerciseId,
  kbController,
}: {
  boxingRounds: RoundOut[];
  kbRounds: RoundOut[];
  exerciseNameById: Record<string, string>;
  techVideoByCode?: Record<string, string | undefined>;
  gifByExerciseId?: Record<string, string | undefined>;
  videoByExerciseId?: Record<string, string | undefined>;
  kbController: KbTrackingController;
}) {
  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalGif, setModalGif] = useState<string | undefined>(undefined);
  const [modalVideo, setModalVideo] = useState<string | undefined>(undefined);

  const openPunchModal = (code: string) => {
    setModalTitle(code);
    setModalGif(undefined);
    setModalVideo(techVideoByCode?.[code]);
    setModalOpen(true);
  };
  const openExerciseModal = (id: string) => {
    const title = exerciseNameById[id] || id;
    setModalTitle(title);
    setModalGif(fixGifUrl(gifByExerciseId?.[id]));
    setModalVideo(videoByExerciseId?.[id]);
    setModalOpen(true);
  };

  const kbSummary = (kbIdx: number, style?: KBStyle) => {
    const row = kbController.state.rounds[kbIdx];
    if (!row) return null;
    if (style === "EMOM") {
      const total = row.totalReps ?? 0;
      return `${total} reps`;
    }
    return `${row.completedRounds ?? 0} rnds`;
  };

  return (
    <>
      {/* Boxing */}
      <section className="futuristic-card p-3 mb-3">
        <div className="fw-bold mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}>
          Boxing Rounds
        </div>

        {!boxingRounds.length ? (
          <div className="text-dim">No boxing rounds</div>
        ) : (
          <div className="p-1">
            {boxingRounds.map((round, idx) => (
              <div
                key={round.round_id || `box-${idx}`}
                className="p-2 mb-2"
                style={{
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold">{round.name || `Boxing Round ${idx + 1}`}</div>
                  <div className="d-flex align-items-center" style={{ gap: 6 }}>
                    {round.style ? (
                      <span
                        className="badge bg-transparent"
                        style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#cfd7df" }}
                        title={
                          round.style === "EMOM"
                            ? "Every Minute On the Minute"
                            : round.style === "AMRAP"
                            ? "As Many Rounds/Reps As Possible"
                            : round.style === "LADDER"
                            ? "Ladder: increase reps smoothly"
                            : String(round.style)
                        }
                      >
                        {round.style}
                      </span>
                    ) : null}
                    <small style={{ opacity: 0.7 }}>{(round.duration_s ?? 180) / 60} mins</small>
                  </div>
                </div>

                <div className="row gx-2 gy-2">
                  {(round.items || []).map((item, i) => {
                    const c = item.combo;
                    const actions = c?.actions || [];
                    const actionsLine = actions.length ? actions.map(a => a.code).join(" • ") : "—";

                    return (
                      <div key={item.item_id || `box-item-${i}`} className="col-12 col-md-4">
                        <div
                          className="p-2"
                          style={{
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1" style={{ gap: 8 }}>
                            <div className="fw-semibold">{c?.name || `Combo ${i + 1}`}</div>
                            <span
                              className="badge bg-transparent"
                              style={{ border: "1px solid rgba(255,127,50,0.35)", color: "#FF8A2A" }}
                            >
                              Combo
                            </span>
                          </div>

                          <div className="text-dim" style={{ fontSize: 13 }}>{actionsLine}</div>

                          {/* Tap punches to open modal */}
                          {actions.length ? (
                            <div className="mt-1">
                              <TechniqueChips actions={actions} techVideoByCode={techVideoByCode} onActionClick={openPunchModal} />
                            </div>
                          ) : null}

                          {c?.notes ? (
                            <div className="mt-1">
                              <small style={{ opacity: 0.8 }}>{c.notes}</small>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Kettlebells */}
      <section className="futuristic-card p-3 mb-3">
        <div className="fw-bold mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}>
          Kettlebell Rounds
        </div>

        {!kbRounds.length ? (
          <div className="text-dim">No kettlebell rounds</div>
        ) : (
          <div className="p-1">
            {kbRounds.map((round, idx) => (
              <div
                key={round.round_id || `kb-${idx}`}
                className="p-2 mb-2"
                style={{
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold">
                    {round.name || `Kettlebells Round ${idx + 1}`}
                  </div>
                  <div className="d-flex align-items-center" style={{ gap: 8 }}>
                    {round.style ? (
                      <span
                        className="badge bg-transparent"
                        style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#cfd7df" }}
                        title={
                          round.style === "EMOM"
                            ? "Every Minute On the Minute: Do the work at each minute, rest the remainder."
                            : round.style === "AMRAP"
                            ? "As Many Rounds/Reps As Possible: Cycle movements steadily."
                            : round.style === "LADDER"
                            ? "Ladder: Alternate movements while increasing reps."
                            : String(round.style)
                        }
                      >
                        {round.style}
                      </span>
                    ) : null}
                    <span className="badge bg-transparent" style={{ border: "1px solid rgba(255,127,50,0.35)", color: "#FF8A2A" }}>
                      {kbSummary(idx, round.style)}
                    </span>
                  </div>
                </div>

                {/* Tracker (compact, responsive) */}
                <KbRoundTracker
                  styleType={round.style}
                  compact={true}
                  rounds={kbController.state.rounds[idx]?.completedRounds ?? 0}
                  onRoundsChange={(v) => kbController.setRounds(idx, v)}
                  onIncRounds={(d) => kbController.incRounds(idx, d)}
                  minuteReps={
                    (kbController.state.rounds[idx]?.emom?.minuteReps as [number, number, number]) || [0, 0, 0]
                  }
                  onMinuteChange={(m, v) => kbController.setEmomMinute(idx, m, v)}
                  onMinuteInc={(m, d) => kbController.incEmomMinute(idx, m, d)}
                />

                {(round.items || []).map((it, i) => {
                  const id = it.exercise_id || "";
                  const displayName = (id && (exerciseNameById[id] || id)) || `Item ${i + 1}`;
                  const bits = [
                    it.reps ? `${it.reps} reps` : "",
                    typeof it.time_s === "number" ? `${it.time_s}s` : "",
                    typeof it.weight_kg === "number" ? `${it.weight_kg}kg` : "",
                    it.tempo ? `${it.tempo}` : "",
                    typeof it.rest_s === "number" ? `rest ${it.rest_s}s` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <div
                      key={it.item_id || `kb-item-${i}`}
                      className="d-flex justify-content-between align-items-center p-2"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <button
                        className="btn btn-bxkr-outline btn-sm"
                        style={{ borderRadius: 999 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          id && openExerciseModal(id);
                        }}
                        title={displayName}
                      >
                        {displayName}
                      </button>
                      {!!bits && <small style={{ opacity: 0.7 }}>{bits}</small>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Media modal */}
      <ModalMedia
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        gifUrl={modalGif}
        videoUrl={modalVideo}
      />
    </>
  );
}
