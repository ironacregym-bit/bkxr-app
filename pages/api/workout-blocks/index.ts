// File: pages/api/workout-blocks/index.ts

import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

type WorkoutDayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

type WorkoutDay = {
  dayName: WorkoutDayName;
  theme?: string;
  strength: string[];
  capacity: string[];
  athletic: string[];
  notes: string[];
  raw: string;
};

type WeekPlan = {
  weekNumber: number;
  theme?: string;
  days: WorkoutDay[];
  raw: string;
};

type CreateWorkoutBlockPayload = {
  title: string;
  focus?: string | null;
  raw_text: string;
  weeks?: WeekPlan[];
  created_by?: string | null;
};

function serialiseTimestamp(value: any): string | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function cleanString(input: unknown, max = 5000): string {
  return String(input || "")
    .trim()
    .slice(0, max);
}

function normaliseStringArray(input: unknown, maxItems = 100): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normaliseWeeks(input: unknown): WeekPlan[] {
  if (!Array.isArray(input)) return [];

  const weeks = input
    .map((w: any): WeekPlan | null => {
      const weekNumber = Number(w?.weekNumber);

      if (!Number.isFinite(weekNumber) || weekNumber < 1) {
        return null;
      }

      const days: WorkoutDay[] = Array.isArray(w?.days)
        ? w.days
            .map((d: any): WorkoutDay | null => {
              const dayName = String(d?.dayName || "").trim() as WorkoutDayName;

              const allowedDays: WorkoutDayName[] = [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ];

              if (!allowedDays.includes(dayName)) {
                return null;
              }

              return {
                dayName,
                theme: cleanString(d?.theme, 160) || undefined,
                strength: normaliseStringArray(d?.strength, 80),
                capacity: normaliseStringArray(d?.capacity, 80),
                athletic: normaliseStringArray(d?.athletic, 80),
                notes: normaliseStringArray(d?.notes, 80),
                raw: cleanString(d?.raw, 12000),
              };
            })
            .filter((d: WorkoutDay | null): d is WorkoutDay => d !== null)
        : [];

      return {
        weekNumber,
        theme: cleanString(w?.theme, 160) || undefined,
        days,
        raw: cleanString(w?.raw, 25000),
      };
    })
    .filter((w): w is WeekPlan => w !== null);

  return weeks.sort((a, b) => a.weekNumber - b.weekNumber);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = firestore;

  if (req.method === "GET") {
    try {
      const rawLimit = Number(req.query.limit || 20);
      const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(50, rawLimit))
        : 20;

      const snap = await db
        .collection("workout_blocks")
        .orderBy("created_at", "desc")
        .limit(limit)
        .get();

      const blocks = snap.docs.map((doc) => {
        const data = doc.data();

        return {
          block_id: data.block_id || doc.id,
          title: data.title || "Untitled block",
          focus: data.focus ?? null,
          raw_text: data.raw_text || "",
          weeks: Array.isArray(data.weeks) ? data.weeks : [],
          created_by: data.created_by ?? null,
          created_at: serialiseTimestamp(data.created_at),
          updated_at: serialiseTimestamp(data.updated_at),
        };
      });

      return res.status(200).json({
        ok: true,
        blocks,
      });
    } catch (err: any) {
      console.error("[workout-blocks] GET error:", err?.message || err);

      return res.status(500).json({
        error: err?.message || "Failed to load workout blocks",
      });
    }
  }

  if (req.method === "POST") {
    try {
      const p = req.body as CreateWorkoutBlockPayload;

      const title = cleanString(p.title, 160);
      const focus = cleanString(p.focus, 240) || null;
      const rawText = cleanString(p.raw_text, 100000);
      const createdBy = cleanString(p.created_by, 320) || null;
      const weeks = normaliseWeeks(p.weeks);

      if (!title) {
        return res.status(400).json({
          error: "title is required",
        });
      }

      if (!rawText && !weeks.length) {
        return res.status(400).json({
          error: "raw_text or weeks is required",
        });
      }

      const ref = db.collection("workout_blocks").doc();
      const now = Timestamp.now();

      await ref.set(
        {
          block_id: ref.id,
          title,
          focus,
          raw_text: rawText,
          weeks,
          created_by: createdBy,
          created_at: now,
          updated_at: now,
          status: "active",
          source: "admin_paste",
          block_type: "farm_strong_6_week",
        },
        { merge: true }
      );

      return res.status(201).json({
        ok: true,
        block_id: ref.id,
      });
    } catch (err: any) {
      console.error("[workout-blocks] POST error:", err?.message || err);

      return res.status(500).json({
        error: err?.message || "Failed to save workout block",
      });
    }
  }

  res.setHeader("Allow", "GET, POST");

  return res.status(405).json({
    error: "Method not allowed",
  });
}
