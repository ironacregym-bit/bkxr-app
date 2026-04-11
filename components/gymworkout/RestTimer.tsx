import React, { useEffect, useMemo, useState } from "react";
import { formatMMSS, GREEN } from "./utils";

export default function RestTimer({ seconds }: { seconds: number | null }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (remaining == null) return;
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((s) => (s == null ? null : Math.max(0, s - 1))), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  const label = useMemo(() => (remaining == null ? "" : formatMMSS(remaining)), [remaining]);

  if (!seconds || seconds <= 0) return null;

  return (
    <div className="d-flex align-items-center gap-2 small mt-1">
      <i className="fas fa-stopwatch" style={{ color: GREEN }} />
      <span className="text-dim">Rest Timer:</span>
      {remaining != null ? <span style={{ color: GREEN, fontWeight: 800 }}>{label}</span> : <span style={{ color: GREEN }}>{seconds}s</span>}

      <button
        type="button"
        className="btn btn-sm btn-outline-light"
        style={{ borderRadius: 12, paddingLeft: 10, paddingRight: 10 }}
        onClick={() => setRemaining(seconds)}
      >
        Start
      </button>

      {remaining != null && remaining > 0 ? (
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          style={{ borderRadius: 12, paddingLeft: 10, paddingRight: 10 }}
          onClick={() => setRemaining(null)}
        >
          Stop
        </button>
      ) : null}
    </div>
  );
}
