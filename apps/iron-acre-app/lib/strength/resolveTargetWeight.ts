// lib/strength/resolveTargetWeight.ts
export function resolveTargetWeightKg({
  trainingMaxKg,
  percent,
  roundingKg = 2.5,
}: {
  trainingMaxKg: number | null;
  percent?: number | null;
  roundingKg?: number;
}) {
  if (!trainingMaxKg || percent == null) return null;
  const raw = trainingMaxKg * percent;
  return Math.round(raw / roundingKg) * roundingKg;
}
