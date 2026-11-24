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

type ProgrammeScheme =
  | "E2MOM"
  | "E3MOM"
  | "E5MOM"
  | "EMOM"
  | "AMRAP"
  | "FOR_TIME"
  | "CHIPPER"
  | "DENSITY"
  | "RELAY"
  | "SETS_REPS"
  | "CUSTOM"
  | string;

type ProgrammeExercise = {
  id?: string;
  name: string;
  reps?: string | null;
  notes?: string | null;
  tracked?: boolean;
  strength_exercise_id?: string | null;
};

type ProgrammeSection = {
  title?: string;
  scheme?: ProgrammeScheme | null;
  schemeLabel?: string | null;
  durationMinutes?: number | null;
  rounds?: number | null;
  instructions?: string[];
  exercises?: ProgrammeExercise[];
};

type WorkoutDaySections = {
  strength?: ProgrammeSection;
  capacity?: ProgrammeSection;
  athletic?: ProgrammeSection;
  notes?: ProgrammeSection;
};

type WorkoutDay = {
  dayName: WorkoutDayName;
  theme?: string;
  strength: string[];
  capacity: string[];
  athletic: string[];
  notes: string[];
  raw: string;
  sections?: WorkoutDaySections;
};

type WeekPlan = {
  weekNumber: number;
  theme?: string;
  days: WorkoutDay[];
  raw: string;
};

type CreateWorkoutBlockPayload = {
  block_id?: string;
  title: string;
  focus?: string | null;
  ai_prompt?: string | null;
  raw_text: string;
  weeks?: WeekPlan[];
  created_by?: string | null;
};

type TrackedStrengthExerciseRef = {
  exercise_name: string;
  strength_exercise_id: string;
  weekNumber: number;
  dayName: WorkoutDayName;
  section: "strength";
};

const ALLOWED_DAYS: WorkoutDayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

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
    .map((x: unknown) => String(x || "").trim())
    .filter((x: string) => Boolean(x))
    .slice(0, maxItems);
}

function toNullableNumber(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;

  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function normaliseScheme(input: unknown): ProgrammeScheme | null {
  const value = cleanString(input, 40);
  return value || null;
}

function normaliseProgrammeExercise(input: any): ProgrammeExercise | null {
  const name = cleanString(input?.name || input?.exercise_name || input?.title, 160);

  if (!name) {
    return null;
  }

  return {
    id: cleanString(input?.id, 160) || undefined,
    name,
    reps: cleanString(input?.reps, 80) || null,
    notes: cleanString(input?.notes, 500) || null,
    tracked: input?.tracked === true || String(input?.tracked || "").toLowerCase() === "true",
    strength_exercise_id: cleanString(input?.strength_exercise_id, 180) || null,
  };
}

function normaliseProgrammeSection(input: any, fallbackTitle: string): ProgrammeSection {
  if (!input || typeof input !== "object") {
    return {
      title: fallbackTitle,
      scheme: null,
      schemeLabel: null,
      durationMinutes: null,
      rounds: null,
      instructions: [],
      exercises: [],
    };
  }

  const exercises = Array.isArray(input?.exercises)
    ? input.exercises
        .map((x: any): ProgrammeExercise | null => normaliseProgrammeExercise(x))
        .filter((x: ProgrammeExercise | null): x is ProgrammeExercise => x !== null)
    : [];

  return {
    title: cleanString(input?.title, 80) || fallbackTitle,
    scheme: normaliseScheme(input?.scheme),
    schemeLabel: cleanString(input?.schemeLabel || input?.scheme_label, 80) || null,
    durationMinutes: toNullableNumber(input?.durationMinutes ?? input?.duration_minutes),
    rounds: toNullableNumber(input?.rounds),
    instructions: normaliseStringArray(input?.instructions, 120),
    exercises,
  };
}

function normaliseSections(input: any): WorkoutDaySections | undefined {
  if (!input || typeof input !== "object") return undefined;

  return {
    strength: normaliseProgrammeSection(input?.strength, "Strength"),
    capacity: normaliseProgrammeSection(input?.capacity, "Capacity"),
    athletic: normaliseProgrammeSection(input?.athletic, "Athletic"),
    notes: normaliseProgrammeSection(input?.notes, "Notes"),
  };
}

function linesFromSection(section?: ProgrammeSection): string[] {
  if (!section) return [];

  const output: string[] = [];

  if (section.schemeLabel) {
    output.push(section.schemeLabel);
  } else if (section.scheme) {
    output.push(String(section.scheme));
  }

  if (section.durationMinutes) {
    output.push(`${section.durationMinutes} mins`);
  }

  if (section.rounds) {
    output.push(`${section.rounds} rounds`);
  }

  if (Array.isArray(section.instructions)) {
    output.push(...section.instructions.filter(Boolean));
  }

  if (Array.isArray(section.exercises)) {
    for (const ex of section.exercises) {
      const pieces = [ex.name];

      if (ex.reps) pieces.push(String(ex.reps));
      if (ex.notes) pieces.push(`- ${ex.notes}`);

      const line = pieces.filter(Boolean).join(" ").trim();

      if (line) {
        output.push(line);
      }
    }
  }

  return output.filter(Boolean);
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

              if (!ALLOWED_DAYS.includes(dayName)) {
                return null;
              }

              const sections = normaliseSections(d?.sections);

              const rawStrength = normaliseStringArray(d?.strength, 120);
              const rawCapacity = normaliseStringArray(d?.capacity, 120);
              const rawAthletic = normaliseStringArray(d?.athletic, 120);
              const rawNotes = normaliseStringArray(d?.notes, 120);

              const day: WorkoutDay = {
                dayName,
                theme: cleanString(d?.theme, 160) || undefined,
                strength: rawStrength.length > 0 ? rawStrength : linesFromSection(sections?.strength),
                capacity: rawCapacity.length > 0 ? rawCapacity : linesFromSection(sections?.capacity),
                athletic: rawAthletic.length > 0 ? rawAthletic : linesFromSection(sections?.athletic),
                notes: rawNotes.length > 0 ? rawNotes : linesFromSection(sections?.notes),
                raw: cleanString(d?.raw, 12000),
              };

              if (sections) {
                day.sections = sections;
              }

              return day;
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
    .filter((w: WeekPlan | null): w is WeekPlan => w !== null);

  return weeks.sort((a, b) => a.weekNumber - b.weekNumber);
}

function strengthExerciseIdFromName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/&/g, " And ")
    .replace(/\bKB\b/gi, "Kettlebell")
    .replace(/\bSA\b/gi, "Single Arm")
    .replace(/\bDB\b/gi, "Dumbbell")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("_");
}

function normalisedNameKey(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bkb\b/g, "kettlebell")
    .replace(/\bsa\b/g, "single arm")
    .replace(/\bdb\b/g, "dumbbell")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((x) => String(x || "").trim()).filter(Boolean)));
}

async function resolveStrengthExerciseId(exerciseName: string): Promise<string> {
  const db = firestore;
  const cleanName = cleanString(exerciseName, 180);

  if (!cleanName) {
    throw new Error("exerciseName is required");
  }

  const baseId = strengthExerciseIdFromName(cleanName);
  const nameKey = normalisedNameKey(cleanName);

  const candidateIds = uniqueStrings([
    baseId,
    cleanName.replace(/\s+/g, "_"),
    cleanName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
  ]);

  for (const candidateId of candidateIds) {
    const candidateRef = db.collection("strength_exercises").doc(candidateId);
    const candidateSnap = await candidateRef.get();

    if (candidateSnap.exists) {
      const existing = candidateSnap.data() || {};

      await candidateRef.set(
        {
          exercise_name: existing.exercise_name || cleanName,
          tracked: true,
          normalised_name: existing.normalised_name || nameKey,
          aliases: uniqueStrings([...(Array.isArray(existing.aliases) ? existing.aliases : []), cleanName]),
          updated_at: Timestamp.now(),
        },
        { merge: true }
      );

      return candidateId;
    }
  }

  const exactNameSnap = await db
    .collection("strength_exercises")
    .where("exercise_name", "==", cleanName)
    .limit(1)
    .get();

  if (!exactNameSnap.empty) {
    const doc = exactNameSnap.docs[0]!;
    const existing = doc.data() || {};

    await doc.ref.set(
      {
        tracked: true,
        normalised_name: existing.normalised_name || nameKey,
        aliases: uniqueStrings([...(Array.isArray(existing.aliases) ? existing.aliases : []), cleanName]),
        updated_at: Timestamp.now(),
      },
      { merge: true }
    );

    return doc.id;
  }

  const normalisedSnap = await db
    .collection("strength_exercises")
    .where("normalised_name", "==", nameKey)
    .limit(1)
    .get();

  if (!normalisedSnap.empty) {
    const doc = normalisedSnap.docs[0]!;
    const existing = doc.data() || {};

    await doc.ref.set(
      {
        tracked: true,
        aliases: uniqueStrings([...(Array.isArray(existing.aliases) ? existing.aliases : []), cleanName]),
        updated_at: Timestamp.now(),
      },
      { merge: true }
    );

    return doc.id;
  }

  const newRef = db.collection("strength_exercises").doc(baseId);
  const now = Timestamp.now();

  await newRef.set(
    {
      exercise_name: cleanName,
      tracked: true,
      normalised_name: nameKey,
      aliases: uniqueStrings([cleanName]),
      max_rep_for_e1rm: 10,
      rounding_kg: 0,
      training_max_factor: 0,
      created_at: now,
      updated_at: now,
      source: "workout_block_editor",
    },
    { merge: true }
  );

  return newRef.id;
}

function cloneSection(section?: ProgrammeSection): ProgrammeSection | undefined {
  if (!section) return undefined;

  return {
    ...section,
    instructions: Array.isArray(section.instructions) ? [...section.instructions] : [],
    exercises: Array.isArray(section.exercises) ? section.exercises.map((ex) => ({ ...ex })) : [],
  };
}

function cloneDay(day: WorkoutDay): WorkoutDay {
  return {
    ...day,
    strength: Array.isArray(day.strength) ? [...day.strength] : [],
    capacity: Array.isArray(day.capacity) ? [...day.capacity] : [],
    athletic: Array.isArray(day.athletic) ? [...day.athletic] : [],
    notes: Array.isArray(day.notes) ? [...day.notes] : [],
    sections: day.sections
      ? {
          strength: cloneSection(day.sections.strength),
          capacity: cloneSection(day.sections.capacity),
          athletic: cloneSection(day.sections.athletic),
          notes: cloneSection(day.sections.notes),
        }
      : undefined,
  };
}

async function resolveTrackedStrengthExercises(weeks: WeekPlan[]): Promise<{
  weeks: WeekPlan[];
  trackedStrengthExercises: TrackedStrengthExerciseRef[];
}> {
  const trackedStrengthExercises: TrackedStrengthExerciseRef[] = [];
  const resolvedWeeks: WeekPlan[] = [];

  for (const week of weeks) {
    const resolvedDays: WorkoutDay[] = [];

    for (const day of week.days) {
      const nextDay = cloneDay(day);
      const strengthExercises = nextDay.sections?.strength?.exercises || [];

      if (strengthExercises.length > 0) {
        const resolvedStrengthExercises: ProgrammeExercise[] = [];

        for (const ex of strengthExercises) {
          const cleanName = cleanString(ex.name, 180);

          if (!cleanName) {
            resolvedStrengthExercises.push({
              ...ex,
              name: "",
              tracked: false,
              strength_exercise_id: null,
            });
            continue;
          }

          if (!ex.tracked) {
            resolvedStrengthExercises.push({
              ...ex,
              name: cleanName,
              tracked: false,
              strength_exercise_id: ex.strength_exercise_id || null,
            });
            continue;
          }

          const resolvedId = ex.strength_exercise_id || (await resolveStrengthExerciseId(cleanName));

          resolvedStrengthExercises.push({
            ...ex,
            name: cleanName,
            tracked: true,
            strength_exercise_id: resolvedId,
          });

          trackedStrengthExercises.push({
            exercise_name: cleanName,
            strength_exercise_id: resolvedId,
            weekNumber: week.weekNumber,
            dayName: day.dayName,
            section: "strength",
          });
        }

        nextDay.sections = {
          ...(nextDay.sections || {}),
          strength: {
            ...(nextDay.sections?.strength || { title: "Strength" }),
            exercises: resolvedStrengthExercises,
          },
        };

        nextDay.strength = linesFromSection(nextDay.sections.strength);
      }

      resolvedDays.push(nextDay);
    }

    resolvedWeeks.push({
      ...week,
      days: resolvedDays,
    });
  }

  return {
    weeks: resolvedWeeks,
    trackedStrengthExercises,
  };
}

function serialiseBlock(doc: any) {
  const data = doc.data() || {};

  return {
    block_id: data.block_id || doc.id,
    title: data.title || "Untitled block",
    focus: data.focus ?? null,
    ai_prompt: data.ai_prompt ?? null,
    raw_text: data.raw_text || "",
    weeks: Array.isArray(data.weeks) ? data.weeks : [],
    tracked_strength_exercises: Array.isArray(data.tracked_strength_exercises)
      ? data.tracked_strength_exercises
      : [],
    created_by: data.created_by ?? null,
    updated_by: data.updated_by ?? null,
    created_at: serialiseTimestamp(data.created_at),
    updated_at: serialiseTimestamp(data.updated_at),
    status: data.status ?? null,
    source: data.source ?? null,
    block_type: data.block_type ?? null,
  };
}

async function buildBlockPayload(input: {
  blockId: string;
  title: string;
  focus: string | null;
  aiPrompt: string | null;
  rawText: string;
  weeks: WeekPlan[];
  actorEmail: string | null;
  mode: "create" | "update";
}) {
  const now = Timestamp.now();
  const resolved = await resolveTrackedStrengthExercises(input.weeks);

  const payload: Record<string, any> = {
    block_id: input.blockId,
    title: input.title,
    focus: input.focus,
    ai_prompt: input.aiPrompt,
    raw_text: input.rawText,
    weeks: resolved.weeks,
    tracked_strength_exercises: resolved.trackedStrengthExercises,
    updated_at: now,
    status: "active",
    source: "admin_editor",
    block_type: "farm_strong_6_week",
  };

  if (input.mode === "create") {
    payload.created_by = input.actorEmail;
    payload.created_at = now;
  } else {
    payload.updated_by = input.actorEmail;
  }

  return payload;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = firestore;

  if (req.method === "GET") {
    try {
      const rawLimit = Number(req.query.limit || 20);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, rawLimit)) : 20;

      const snap = await db
        .collection("workout_blocks")
        .orderBy("created_at", "desc")
        .limit(limit)
        .get();

      const blocks = snap.docs.map((doc) => serialiseBlock(doc));

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
      const aiPrompt = cleanString(p.ai_prompt, 20000) || null;
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

      const payload = await buildBlockPayload({
        blockId: ref.id,
        title,
        focus,
        aiPrompt,
        rawText,
        weeks,
        actorEmail: createdBy,
        mode: "create",
      });

      await ref.set(payload, { merge: true });

      return res.status(201).json({
        ok: true,
        block_id: ref.id,
        tracked_strength_exercises: payload.tracked_strength_exercises || [],
      });
    } catch (err: any) {
      console.error("[workout-blocks] POST error:", err?.message || err);

      return res.status(500).json({
        error: err?.message || "Failed to save workout block",
      });
    }
  }

  if (req.method === "PUT") {
    try {
      const p = req.body as CreateWorkoutBlockPayload;

      const blockId = cleanString(p.block_id, 160);
      const title = cleanString(p.title, 160);
      const focus = cleanString(p.focus, 240) || null;
      const aiPrompt = cleanString(p.ai_prompt, 20000) || null;
      const rawText = cleanString(p.raw_text, 100000);
      const updatedBy = cleanString(p.created_by, 320) || null;
      const weeks = normaliseWeeks(p.weeks);

      if (!blockId) {
        return res.status(400).json({
          error: "block_id is required",
        });
      }

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

      const ref = db.collection("workout_blocks").doc(blockId);
      const existing = await ref.get();

      if (!existing.exists) {
        return res.status(404).json({
          error: "Workout block not found",
        });
      }

      const payload = await buildBlockPayload({
        blockId,
        title,
        focus,
        aiPrompt,
        rawText,
        weeks,
        actorEmail: updatedBy,
        mode: "update",
      });

      await ref.set(payload, { merge: true });

      return res.status(200).json({
        ok: true,
        block_id: blockId,
        tracked_strength_exercises: payload.tracked_strength_exercises || [],
      });
    } catch (err: any) {
      console.error("[workout-blocks] PUT error:", err?.message || err);

      return res.status(500).json({
        error: err?.message || "Failed to update workout block",
      });
    }
  }

  res.setHeader("Allow", "GET, POST, PUT");

  return res.status(405).json({
    error: "Method not allowed",
  });
}
