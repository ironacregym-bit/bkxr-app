import React, { useMemo } from "react";
import Link from "next/link";
import SessionTimer from "./SessionTimer";
import { hhmm, GREEN } from "./utils";

export default function HeaderBar({
  workoutName,
  volumeKg,
  loggedSetCount,
  isCompleted,
  onFinish,
  weekStartKey,
  weekEndKey,
}: {
  workoutName: string;
  volumeKg: number;
  loggedSetCount: number;
  isCompleted: boolean;
  onFinish: () => void;
  weekStartKey: string;
  weekEndKey: string;
}) {
  const time = useMemo(() => hhmm(), []);

  return (
    <>
      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div className="text-dim small" style={{ minWidth: 52 }}>
          {time}
        </div>

        <div className="flex-fill" style={{ minWidth: 0 }}>
          <div className="fw-bold text-truncate" style={{ lineHeight: 1.1 }}>
            {workoutName}
          </div>
          <div className="text-dim small">
            Volume {volumeKg} kg • Sets {loggedSetCount}
          </div>
          <div className="mt-2">
            <SessionTimer />
          </div>
        </div>

        <button
          className="btn btn-sm"
          style={{
            borderRadius: 14,
            background: GREEN,
            color: "#0b0f14",
            fontWeight: 900,
            paddingLeft: 14,
            paddingRight: 14,
            opacity: isCompleted ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
          onClick={onFinish}
          disabled={isCompleted}
          title={isCompleted ? "Already completed this week" : "Finish session"}
        >
          Finish
        </button>
      </div>

      <div className="text-dim small mb-3">
        /
          ← Back
        </Link>
        <span style={{ marginLeft: 10 }}>
          Week window <span className="fw-semibold">{weekStartKey}</span> →{" "}
          <span className="fw-semibold">{weekEndKey}</span>
        </span>
      </div>
    </>
  );
}
