
"use client";

import React, { useEffect, useRef, useState } from "react";

type Mode = "work" | "rest";

export default function RoundTimer({
  rounds = 10,
  boxRounds = 5,
  work = 180, // 3 minutes
  rest = 60,  // 1 minute
}: {
  rounds?: number;
  boxRounds?: number;
  work?: number;
  rest?: number;
}) {
  const [round, setRound] = useState<number>(1);
  const [mode, setMode] = useState<Mode>("work");
  const [remaining, setRemaining] = useState<number>(work);
  const [running, setRunning] = useState<boolean>(false);

  // --- Refs to avoid stale closures inside setInterval ---
  const roundRef = useRef<number>(round);
  const modeRef = useRef<Mode>(mode);
  const remainingRef = useRef<number>(remaining);
  const runningRef = useRef<boolean>(running);

  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { remainingRef.current = remaining; }, [remaining]);
  useEffect(() => { runningRef.current = running; }, [running]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const beep = useRef<HTMLAudioElement | null>(null);
  const tripleBell = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof Audio !== "undefined") {
      beep.current = new Audio("/beep.mp3");
      beep.current.volume = 0.8;
      tripleBell.current = new Audio("/triple-bell.mp3");
      tripleBell.current.volume = 0.9;
    }
  }, []);

  const playBeep = () => {
    if (beep.current) {
      beep.current.currentTime = 0;
      void beep.current.play().catch(() => {});
    }
  };

  const playTripleBell = () => {
    if (tripleBell.current) {
      tripleBell.current.currentTime = 0;
      void tripleBell.current.play().catch(() => {});
    }
  };

  // Helper: did we cross a threshold between prev -> next? (handles timer skips)
  function crossed(prev: number, next: number, mark: number) {
    return prev > mark && next <= mark;
  }

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;

        // WORK-phase mid beeps: trigger exactly once when crossing 2:00 and 1:00
        if (modeRef.current === "work") {
          if (crossed(prev, next, 120) || crossed(prev, next, 60)) {
            playBeep();
          }
        }

        // Handle transitions
        if (next < 0) {
          if (modeRef.current === "work") {
            // End of WORK -> enter REST
            playTripleBell();
            setMode("rest");
            return rest;
          } else {
            // End of REST -> next round or finish
            const nextRound = roundRef.current + 1;
            if (nextRound > rounds) {
              playTripleBell(); // workout complete
              setRunning(false);
              return 0;
            }
            setRound(nextRound);
            setMode("work");
            playBeep(); // beep at start of next work
            if (
              nextRound === boxRounds + 1 &&
              typeof window !== "undefined" &&
              "speechSynthesis" in window
            ) {
              window.speechSynthesis.speak(
                new SpeechSynthesisUtterance("Switch to kettlebell")
              );
            }
            return work;
          }
        }

        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, work, rest, rounds, boxRounds]);
  // ^ We rely on refs for mode/round/remaining to avoid stale closures and
  //   keep the dependencies stable for the ticking effect.

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(Math.max(remaining % 60, 0)).padStart(2, "0");
  const side = round <= boxRounds ? "BOX" : "BELL";

  // Minute split tracker (only for work mode)
  const minuteSplit = mode === "work" ? Math.ceil((work - remaining) / 60) : null;

  const handleStart = () => {
    setRunning(true);
    // Initial user gesture unlocks audio on iOS/Safari
    playBeep();
  };
  const handlePause = () => setRunning(false);
  const handleReset = () => {
    setRunning(false);
    setRound(1);
    setMode("work");
    setRemaining(work);
  };

  return (
    <div style={{ background: "#101522", border: "1px solid #243049", borderRadius: 12, padding: 12 }}>
      <div style={{ color: "#9fb3c8", textTransform: "uppercase", letterSpacing: ".1em" }}>
        Round {round}/{rounds} • {side} • {mode === "work" ? "WORK (3:00)" : "REST (1:00)"}
      </div>

      <div style={{ fontSize: 56, fontWeight: 800, margin: "8px 0" }}>
        {mm}:{ss}
      </div>

      {mode === "work" && (
        <div style={{ color: "#6f8399", fontSize: 14, marginBottom: 8 }}>
          Minute Split: {minuteSplit}/3
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleStart} disabled={running} style={btnStyle("primary")}>
          Start
        </button>
        <button onClick={handlePause} disabled={!running} style={btnStyle("secondary")}>
          Pause
        </button>
        <button onClick={handleReset} style={btnStyle("outline")}>
          Reset
        </button>
      </div>

      <div style={{ marginTop: 8, color: "#6f8399", fontSize: 12 }}>
        Beeps at start, and when crossing 2:00 & 1:00 in each WORK phase. Triple bell at round end.
      </div>
    </div>
  );
}

function btnStyle(variant: "primary" | "secondary" | "outline") {
  const base: React.CSSProperties = {
    cursor: "pointer",
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid transparent",
    fontWeight: 600,
  };
  switch (variant) {
    case "primary":
      return { ...base, background: "#0d6efd", color: "#fff" };
    case "secondary":
      return { ...base, background: "#6c757d", color: "#fff" };
    case "outline":
      return { ...base, background: "transparent", color: "#9fb3c8", border: "1px solid #243049" };
  }
}
``
