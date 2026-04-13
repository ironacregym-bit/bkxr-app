export const IA = {
  neon: "#18ff9a",
  neon2: "#00e5ff",
  bgA: "rgba(0,0,0,0.42)",
  bgB: "rgba(0,0,0,0.18)",
  borderSoft: "rgba(24,255,154,0.18)",
  border: "rgba(24,255,154,0.34)",
  glowSoft: "0 0 18px rgba(24,255,154,0.10)",
  glow: "0 0 24px rgba(24,255,154,0.28)",
};

export function neonCardStyle(extra?: Partial<React.CSSProperties>): React.CSSProperties {
  return {
    border: `1px solid ${IA.borderSoft}`,
    background: `linear-gradient(180deg, ${IA.bgA}, ${IA.bgB})`,
    boxShadow: `0 0 0 1px rgba(24,255,154,0.07) inset, 0 18px 40px rgba(0,0,0,0.45)`,
    ...extra,
  };
}

export function neonButtonStyle(extra?: Partial<React.CSSProperties>): React.CSSProperties {
  return {
    borderRadius: 999,
    border: `1px solid rgba(24,255,154,0.45)`,
    background: "rgba(0,0,0,0.20)",
    color: IA.neon,
    fontWeight: 900,
    boxShadow: "0 0 14px rgba(24,255,154,0.14)",
    ...extra,
  };
}

export function neonPrimaryStyle(extra?: Partial<React.CSSProperties>): React.CSSProperties {
  return {
    borderRadius: 14,
    background: `linear-gradient(90deg, ${IA.neon}, ${IA.neon2})`,
    color: "#06110c",
    fontWeight: 950,
    letterSpacing: 0.9,
    border: "none",
    boxShadow: `0 0 24px rgba(24,255,154,0.32)`,
    ...extra,
  };
}
