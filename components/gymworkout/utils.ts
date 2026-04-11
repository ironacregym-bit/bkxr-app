import type { StrengthSpec } from "./types";

export const ACCENT = "#FF8A2A";
export const GREEN = "#22c55e";

export function fixGifUrl(u?: string) {
  if (!u) return u;
  if (u.startsWith("public/")) return "/" + u.replace(/^public\//, "");
  return u;
}

export function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}

export function startOfAlignedWeek(d: Date) {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}

export function endOfAlignedWeek(d: Date) {
  const s = startOfAlignedWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

export function roundToIncrement(value: number, increment: number): number {
  if (!increment || increment <= 0) return Math.round(value);
  return Math.round(value / increment) * increment;
}

export function hhmm() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function percentLabel(strength?: StrengthSpec | null): string | null {
  if (!strength) return null;
  if (strength.percent_min != null && strength.percent_max != null) {
    return `${Math.round(strength.percent_min * 100)}–${Math.round(strength.percent_max * 100)}%`;
  }
  if (strength.percent_1rm != null) return `${Math.round(strength.percent_1rm * 100)}%`;
  return null;
}

export function pctToUse(strength?: StrengthSpec | null): number | null {
  if (!strength) return null;
  if (strength.percent_1rm != null) return strength.percent_1rm;
  if (strength.percent_min != null && strength.percent_max != null) return (strength.percent_min + strength.percent_max) / 2;
  return null;
}

export function computeTargetKg(args: {
  strength?: StrengthSpec | null;
  trainingMaxes: Record<string, number>;
  defaultRounding: number;
}): { targetKg: number | null; pctLabel: string | null; key: string } {
  const { strength, trainingMaxes, defaultRounding } = args;
  const pct = pctToUse(strength);
  const pctLbl = percentLabel(strength);
  const key = String(strength?.basis_exercise || "").trim();
  if (!strength || pct == null || !key) return { targetKg: null, pctLabel: pctLbl, key };
  const max = Number(trainingMaxes[key]);
  if (!Number.isFinite(max) || max <= 0) return { targetKg: null, pctLabel: pctLbl, key };
  const inc = strength.rounding_kg ?? defaultRounding ?? 2.5;
  const raw = max * pct;
  return { targetKg: roundToIncrement(raw, inc), pctLabel: pctLbl, key };
}

export function formatMMSS(totalSec: number) {
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
