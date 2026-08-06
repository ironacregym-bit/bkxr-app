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

  // New structured model, additive to avoid breaking existing saved blocks.
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
  if (!name) return null;

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

  if (section.schemeLabel) output.push(section.schemeLabel);
  else if (section.scheme) output.push(String(section.scheme));

  if (section.durationMinutes) output.push(`${section.durationMinutes} mins`);
  if (section.rounds) output.push(`${section.rounds} rounds`);

  if (Array.isArray(section.instructions)) {
    output.push(...section.instructions.filter(Boolean));
  }

  if (Array.isArray(section.exercises)) {
    for (const ex of section.exercises) {
      const pieces = [ex.name];

      if (ex.reps) pieces.push(String(ex.reps));
      if (ex.notes) pieces.push(`- ${ex.notes}`);

      output.push(pieces.filter(Boolean).join(" "));
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

              const strength =
                normaliseStringArray(d?.strength, 120).length > 0
                  ? normaliseStringArray(d?.strength, 120)
                  : linesFromSection(sections?.strength);

              const capacity =
                normaliseStringArray(d?.capacity, 120).length > 0
                  ? normaliseStringArray(d?.capacity, 120)
                  : linesFromSection(sections?.capacity);

              const athletic =
                normaliseStringArray(d?.athletic, 120).length > 0
                  ? normaliseStringArray(d?.athletic, 120)
                  : linesFromSection(sections?.athletic);

              const notes =
                normaliseStringArray(d?.notes, 120).length > 0
                  ? normaliseStringArray(d?.notes, 120)
                  : linesFromSection(sections?.notes);

              const day: WorkoutDay = {
                dayName,
                theme: cleanString(d?.theme, 160) || undefined,
                strength,
                capacity,
                athletic,
                notes,
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
    const doc = exactNameSnap.docs[0];
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
    const doc = normalisedSnap.docs[0];
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

async function resolveTrackedStrengthExercises(weeks: WeekPlan[]): Promise<{
  weeks: WeekPlan[];
  trackedStrengthExercises: TrackedStrengthExerciseRef[];
}> {
  const trackedStrengthExercises: TrackedStrengthExerciseRef[] = [];

  const resolvedWeeks: WeekPlan[] = [];

  for (const week of weeks) {
    const resolvedDays: WorkoutDay[] = [];

    for (const day of week.days) {
      const nextDay: WorkoutDay = {
        ...day,
        strength: Array.isArray(day.strength) ? [...day.strength] : [],
        capacity: Array.isArray(day.capacity) ? [...day.capacity] : [],
        athletic: Array.isArray(day.athletic) ? [...day.athletic] : [],
        notes: Array.isArray(day.notes) ? [...day.notes] : [],
        sections: day.sections
          ? {
              strength: day.sections.strength
                ? {
                    ...day.sections.strength,
                    instructions: Array.isArray(day.sections.strength.instructions)
                      ? [...day.sections.strength.instructions]
                      : [],
                    exercises: Array.isArray(day.sections.strength.exercises)
                      ? [...day.sections.strength.exercises]
                      : [],
                  }
                : undefined,
              capacity: day.sections.capacity
                ? {
                    ...day.sections.capacity,
                    instructions: Array.isArray(day.sections.capacity.instructions)
                      ? [...day.sections.capacity.instructions]
                      : [],
                    exercises: Array.isArray(day.sections.capacity.exercises)
                      ? [...day.sections.capacity.exercises]
                      : [],
                  }
                : undefined,
              athletic: day.sections.athletic
                ? {
                    ...day.sections.athletic,
                    instructions: Array.isArray(day.sections.athletic.instructions)
                      ? [...day.sections.athletic.instructions]
                      : [],
                    exercises: Array.isArray(day.sections.athletic.exercises)
                      ? [...day.sections.athletic.exercises]
                      : [],
                  }
                : undefined,
              notes: day.sections.notes
                ? {
                    ...day.sections.notes,
                    instructions: Array.isArray(day.sections.notes.instructions)
                      ? [...day.sections.notes.instructions]
                      : [],
                    exercises: Array.isArray(day.sections.notes.exercises)
                      ? [...day.sections.notes.exercises]
                      : [],
                  }
                : undefined,
            }
          : undefined,
      };

      const strengthExercises = nextDay.sections?.strength?.exercises || [];

      if (strengthExercises.length) {
        const resolvedStrengthExercises: ProgrammeExercise[] = [];

        for (const ex of strengthExercises) {
          if (!ex.tracked) {
            resolvedStrengthExercises.push(ex);
            continue;
          }

          const resolvedId = ex.strength_exercise_id || (await resolveStrengthExerciseId(ex.name));

          resolvedStrengthExercises.push({
            ...ex,
            tracked: true,
            strength_exercise_id: resolvedId,
          });

          trackedStrengthExercises.push({
            exercise_name: ex.name,
            strength_exercise_id: resolvedId,
            weekNumber: week.weekNumber,
            dayName: day.dayName,
            section: "strength",
          });
        }

        nextDay.sections = {
          ...(nextDay.sections || {}),
          strength: {
            ...(nextDay.sections?.strength || {
