// components/iron-acre/TasksCard.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function TasksCard({
  todayData,
  fridayYMD,
  fridayData,
}: any) {
  const [open, setOpen] = useState(false);

  const habitsCompleted = Number(todayData?.habitSummary?.completed || 0);
  const habitsTotal = Number(todayData?.habitSummary?.total || 0);

  const showWeeklyCheckIn = Boolean(todayData?.isFriday);
  const checkinDone = Boolean(fridayData?.checkinComplete);

  const taskCount = showWeeklyCheckIn ? 2 : 1;

  return (
    <section className="ia-tile ia-tile-pad mb-2">
      
      {/* Header */}
      <div className="ia-section-header">
        <div className="ia-kicker">
          <i className="fas fa-list-check" />
          TASKS
        </div>

        <button
          className="ia-task-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          <i className={`fas fa-chevron-${open ? "up" : "down"}`} />
          {taskCount} tasks
        </button>
      </div>

      {/* Always visible summary (no big title anymore) */}
      {!open && (
        <div className="ia-task-sub mt-1">
          {showWeeklyCheckIn
            ? `${habitsCompleted}/${habitsTotal} habits • check-in ${checkinDone ? "done" : "open"}`
            : `${habitsCompleted}/${habitsTotal} habits logged`}
        </div>
      )}

      {/* Expanded */}
      {open && (
        <div className="mt-2">

          {/* Daily habits */}
          <div className="ia-task-row">
            <div>
              <div className="ia-task-title">Daily habits</div>
              <div className="ia-task-sub">
                {habitsCompleted}/{habitsTotal} completed
              </div>
            </div>

            <Link href="/habits" className="ia-btn ia-btn-primary ia-btn-sm">
              Open
            </Link>
          </div>

          {/* Weekly check-in */}
          {showWeeklyCheckIn && (
            <div className="ia-task-row">
              <div>
                <div className="ia-task-title">Weekly check-in</div>
                <div className="ia-task-sub">
                  {checkinDone ? "Completed" : "Open"}
                </div>
              </div>

              <Link href="/checkin" className="ia-btn ia-btn-primary ia-btn-sm">
                Open
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
