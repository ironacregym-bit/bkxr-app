import React, { useEffect, useMemo, useState } from "react";
import { formatMMSS, GREEN } from "./utils";

export default function SessionTimer({
  onTickSeconds,
}: {
  onTickSeconds?: (sec: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!running || startedAt == null) return;
    const t = setInterval(() => {
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSec(sec);
      onTickSeconds?.(sec);
    }, 1000);
    return () => clearInterval(t);
  }, [running, startedAt, onTickSeconds]);

  const label = useMemo(() => formatMMSS(elapsedSec), [elapsedSec]);

  return (
    <div className="d-flex align-items-center gap-2">
      <div className="text-dim small">Duration</div>
      <div style={{ color: GREEN, fontWeight: 800, minWidth: 52 }}>{label}</div>

      <button
        type="button"
        className="btn btn-sm"
        style={{
          borderRadius: 12,
          background: running ? "transparent" : GREEN,
          color: running ? GREEN : "#0b0f14",
          border: running ? `1px solid ${GREEN}88` : "none",
          fontWeight: 800,
          paddingLeft: 12,
          paddingRight: 12,
        }}
        onClick={() => {
          if (!running) {
            setStartedAt(Date.now() - elapsedSec * 1000);
            setRunning(true);
          } else {
            setRunning(false);
          }
        }}
      >
        {running ? "Pause" : "Start"}
      </button>

      <button
        type="button"
        className="btn btn-sm btn-outline-light"
        style={{ borderRadius: 12 }}
        onClick={() => {
          setRunning(false);
          setStartedAt(null);
          setElapsedSec(0);
          onTickSeconds?.(0);
        }}
      >
        Reset
      </button>
    </div>
  );
}
