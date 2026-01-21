
// components/workouts/ListViewer.tsx
"use client";

import TechniqueChips, { BoxingAction } from "./TechniqueChips";
import ProtocolBadge, { KBStyle } from "./ProtocolBadge";

/**
 * Linear list view with Boxing + Kettlebell sections.
 * - Includes TechniqueChips under each boxing combo (with optional technique links)
 * - Includes ProtocolBadge (EMOM/AMRAP/LADDER explainer) next to kettlebell round titles
 */

type ExerciseItemOut = {
  item_id: string;
  type: "Boxing" | "Kettlebell";
  style?: KBStyle | "Combo";
  order: number;

  // Boxing
  duration_s?: number;
  combo?: { name?: string; actions: BoxingAction[]; notes?: string };

  // Kettlebell
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
  style?: KBStyle;
  duration_s?: number;
  items: ExerciseItemOut[];
};

export default function ListViewer({
  boxingRounds,
  kbRounds,
  exerciseNameById,
  techVideoByCode, // ✅ optional and now typed
}: {
  boxingRounds: RoundOut[];
  kbRounds: RoundOut[];
  exerciseNameById: Record<string, string>;
  techVideoByCode?: Record<string, string | undefined>;
}) {
  return (
    <>
      {/* Boxing */}
      <section className="futuristic-card p-3 mb-3">
        <div
          className="fw-bold mb-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 8 }}
        >
          Boxing Rounds
        </div>

        {boxingRounds.length === 0 ? (
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
                <div
                  className="d-flex justify-content-between align-items-center mb-2"
                  style={{ gap: 8 }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {round.name || `Boxing Round ${idx + 1}`}
                  </div>
                  <small style={{ opacity: 0.7 }}>
                    {(round.duration_s ?? 180) / 60} mins
                  </small>
                </div>

                <div className="row gx-2 gy-2">
                  {(round.items || []).map((item, i) => {
                    const c = item.combo;
                    const actions = c?.actions || [];
                    const actionsLine =
                      actions.length > 0
                        ? actions.map((a) => a.code).join(" • ")
                        : "—";

                    return (
                      <div
                        key={item.item_id || `box-item-${i}`}
                        className="col-12 col-md-4"
                      >
                        <div
                          className="p-2"
                          style={{
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div
                            className="d-flex align-items-center justify-content-between mb-1"
                            style={{ gap: 8 }}
                          >
                            <div className="fw-semibold">
                              {c?.name || `Combo ${i + 1}`}
                            </div>
                            <span
                              className="badge bg-transparent"
                              style={{
                                border: "1px solid rgba(255,127,50,0.35)",
                                color: "#FF8A2A",
                              }}
                            >
                              Combo
                            </span>
                          </div>

                          {/* Simple codes line */}
                          <div className="text-dim" style={{ fontSize: 13 }}>
                            {actionsLine}
                          </div>

                          {/* Technique video chips */}
                          {actions.length > 0 ? (
                            <div className="mt-1">
                              <TechniqueChips
                                actions={actions}
                                techVideoByCode={techVideoByCode}
                              />
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
        <div
          className="fw-bold mb-2"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.15)",
            paddingBottom: 8,
          }}
        >
          Kettlebell Rounds
        </div>

        {kbRounds.length === 0 ? (
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
                <div
                  className="d-flex justify-content-between align-items-center mb-2"
                  style={{ gap: 8 }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {round.name || `Kettlebells Round ${idx + 1}`}
                    {round.style ? (
                      <ProtocolBadge
                        style={round.style as KBStyle}
                        summaryLabel={round.style}
                      />
                    ) : null}
                  </div>
                  {round.style ? (
                    <span
                      className="badge bg-transparent"
                      style={{
                        border: "1px solid rgba(255,255,255,0.18)",
                        color: "#cfd7df",
                      }}
                      title={round.style}
                    >
                      {round.style}
                    </span>
                  ) : null}
                </div>

                {(round.items || []).map((it, i) => {
                  const displayName =
                    (it.exercise_id && exerciseNameById[it.exercise_id]) ||
                    it.exercise_id ||
                    `Item ${i + 1}`;
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
                      <div>
                        <div style={{ fontWeight: 600 }}>{displayName}</div>
                        {!!bits && (
                          <small style={{ opacity: 0.7 }}>{bits}</small>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
