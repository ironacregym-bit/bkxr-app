import type { AdminRoundFetch, DayName, GymRound, SingleItem, SupersetItem, SupersetSubItem } from "./types";
import { DAYS } from "./types";

export const mkUid = () => {
  try {
    // @ts-ignore
    return crypto?.randomUUID ? crypto.randomUUID() : `uid_${Math.random().toString(36).slice(2)}`;
  } catch {
    return `uid_${Math.random().toString(36).slice(2)}`;
  }
};

export function toYMD(input: any): string {
  if (!input) return "";
  try {
    if (typeof input === "string") {
      const s = input.trim();
      if (s.length >= 10 && /\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const d = new Date(s);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    if (typeof input === "object" && input !== null && typeof (input as any).seconds === "number") {
      const ts = input as { seconds: number; nanoseconds?: number };
      const ms = ts.seconds * 1000 + (ts.nanoseconds ? ts.nanoseconds / 1e6 : 0);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    if (input instanceof Date) {
      return isNaN(input.getTime()) ? "" : input.toISOString().slice(0, 10);
    }
    if (typeof input === "number") {
      const d = new Date(input);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    const s = String(input);
    if (/\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export function renumber(items: Array<SingleItem | SupersetItem>): Array<SingleItem | SupersetItem> {
  return items.map((it, i) => ({ ...it, order: i + 1 }));
}

export function newSupersetSub(): SupersetSubItem {
  return { uid: mkUid(), exercise_id: "", reps: "" };
}

export function toUIRound(r?: AdminRoundFetch | null, fallbackName = "Round", fallbackOrder = 1): GymRound | null {
  if (!r) return null;

  const rawItems: any[] = Array.isArray(r.items) ? r.items : [];
  const uiItems: Array<SingleItem | SupersetItem> = rawItems.map((it: any, idx: number) => {
    const order = Number.isFinite(it?.order) ? it.order : idx + 1;

    if (String(it?.type) === "Superset") {
      const subs: any[] = Array.isArray(it.items)
        ? it.items
        : Array.isArray(it.superset_items)
        ? it.superset_items
        : [];

      const mappedSubs: SupersetSubItem[] = subs.map((s: any) => ({
        uid: mkUid(),
        exercise_id: String(s?.exercise_id || ""),
        reps: typeof s?.reps === "string" ? s.reps : s?.reps != null ? String(s.reps) : "",
        weight_kg: typeof s?.weight_kg === "number" ? s.weight_kg : s?.weight_kg ?? null,
      }));

      return {
        uid: mkUid(),
        type: "Superset",
        order,
        name: (it?.name ?? "") || "",
        items: mappedSubs.length ? mappedSubs : [newSupersetSub()],
        sets: Number.isFinite(it?.sets) ? it.sets : 3,
        rest_s: it?.rest_s ?? null,
        notes: it?.notes ?? null,
      };
    }

    return {
      uid: mkUid(),
      type: "Single",
      order,
      exercise_id: String(it?.exercise_id || ""),
      sets: Number.isFinite(it?.sets) ? it.sets : undefined,
      reps: typeof it?.reps === "string" ? it.reps : it?.reps != null ? String(it.reps) : "",
      weight_kg: typeof it?.weight_kg === "number" ? it.weight_kg : it?.weight_kg ?? null,
      rest_s: it?.rest_s ?? null,
      notes: it?.notes ?? null,
      strength: it?.strength ?? null,
    };
  });

  return {
    name: (r?.name || fallbackName) as string,
    order: Number.isFinite(r?.order) ? (r!.order as number) : fallbackOrder,
    items: uiItems,
  };
}

export function toISODateOrNull(s: string): string | null {
  if (!s) return null;
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return null;
  dt.setHours(12, 0, 0, 0);
  return dt.toISOString();
}

export function safeDay(dayRaw: string, fallback: DayName): DayName {
  return (DAYS as readonly string[]).includes(dayRaw) ? (dayRaw as DayName) : fallback;
}
