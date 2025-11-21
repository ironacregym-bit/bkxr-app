import React, { useEffect, useRef, useState } from "react";

type Mode = "work" | "rest";

export default function RoundTimer({
  rounds = 10,        // total rounds
  boxRounds = 5,      // first N rounds are "BOX", remaining are "BELL"
  work = 180,         // 3 minutes work
  rest = 60           // 1 minute rest
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

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const bell = useRef<HTMLAudioElement | null>(null);

  // Preload audio
  useEffect(() => {
    if (typeof Audio !== "undefined") {
      bell.current = new Audio("/beep.mp3"); // make sure this file exists
      bell.current.volume = 0.8;
    }
  }, []);

  // Minute interval alerts during WORK (at 2:00 and 1:00 left)
  const playAlert = () => bell.current?.play();

  // Main ticking effect
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1;

        // Fire 1-minute interval alerts (only in WORK mode)
        if (mode === "work") {
          if (next === 120 || next === 60) {
            playAlert();
          }
        }

        // Phase end?
        if (next < 0) {
          // Transition between modes
          if (mode === "work") {
            // End of 3-minute work: go to REST 1 minute
            playAlert();
            setMode("rest");
            return rest;
          } else {
            // End of rest: advance round or finish
            const nextRound = round + 1;

            if (nextRound > rounds) {
              // Completed all rounds
              playAlert();
              setRunning(false);
              return 0;
            }

            // Round switch (rest -> work)
            setRound(nextRound);
            setMode("work");

            // Optional speech cue when switching from BOX to BELL
            if (nextRound === boxRounds + 1 && typeof window !== "undefined" && "speechSynthesis" in window) {
              window.speechSynthesis.speak(new SpeechSynthesisUtterance("Switch to kettlebell"));
            }

            playAlert();
            return work;
          }
        }

        return next;
      });
    }, 1000);

    // Cleanup
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running, mode, round, work, rest, rounds, boxRounds]);

  // UI helpers
  const side = round <= boxRounds ? "BOX" : "BELL";
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(Math.max(remaining % 60, 0)).padStart(2, "0");

  const handleStart = () => setRunning(true);
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
        Round {round}/{rounds} • {side} • {mode.toUpperCase()}
      </div>

      <div style={{ fontSize: 56, fontWeight: 800, margin: "8px 0" }}>
        {mm}:{ss}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleStart} disabled={running} style={btnStyle("primary")}>Start</button>
        <button onClick={handlePause} disabled={!running} style={btnStyle("secondary")}>Pause</button>
        <button onClick={handleReset} style={btnStyle("outline")}>Reset</button>
      </div>

      {/* Optional helper text */}
      <div style={{ marginTop: 8, color: "#6f8399", fontSize: 12 }}>
        Work is 3:00 per round with alerts at 2:00 and 1:00. Rest is 1:00 between rounds.
      </div>
    </div>
  );
}

// Tiny button styling helper to keep inline styles consistent
function btnStyle(variant: "primary" | "secondary" | "outline") {
  const base = {
    cursor: "pointer",
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid transparent",
    fontWeight: 600,
  } as React.CSSProperties;

  switch (variant) {
    case "primary":
      return { ...base, background: "#0d6efd", color: "#fff" };
    case "secondary":
      return { ...base, background: "#6c757d", color: "#fff" };
    case "outline":
      return { ...base, background: "transparent", color: "#9fb3c8", border: "1px solid #243049" };
  }
}
