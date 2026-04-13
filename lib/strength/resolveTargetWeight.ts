export function resolveTargetWeightKg(args: {
  trainingMaxKg: number | null;
  percent?: number | null;
  percentMin?: number | null;
  percentMax?: number | null;
  roundingKg?: number | null;
}) {
  const {
    trainingMaxKg,
    percent,
    percentMin,
    percentMax,
    roundingKg = 2.5,
  } = args;

  if (!trainingMaxKg) return null;

  const pct =
    percent != null
      ? percent
      : percentMin != null && percentMax != null
      ? (percentMin + percentMax) / 2
      : null;

  if (pct == null) return null;

  const raw = trainingMaxKg * pct;
  return Math.round(raw / roundingKg) * roundingKg;
}
