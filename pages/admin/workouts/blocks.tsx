// File: pages/admin/workouts/blocks.tsx

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../../../components/BottomNav";

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
  | "CUSTOM";

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

type WorkoutBlock = {
  block_id: string;
  title: string;
  focus?: string | null;
  ai_prompt?: string | null;
  raw_text: string;
  weeks: WeekPlan[];
  tracked_strength_exercises?: Array<{
    exercise_name: string;
    strength_exercise_id: string;
    weekNumber: number;
    dayName: WorkoutDayName;
  }>;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type BlocksResponse = {
  ok: boolean;
  blocks: WorkoutBlock[];
};

type DaySectionKey = "strength" | "capacity" | "athletic" | "notes";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const DAY_NAMES: WorkoutDayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DEFAULT_TRAINING_DAYS: WorkoutDayName[] = ["Monday", "Wednesday", "Friday", "Saturday"];

const SCHEME_OPTIONS: Array<{ value: ProgrammeScheme; label: string }> = [
  { value: "E2MOM", label: "E2MOM" },
  { value: "E3MOM", label: "E3MOM" },
  { value: "E5MOM", label: "E5MOM" },
  { value: "EMOM", label: "EMOM" },
  { value: "AMRAP", label: "AMRAP" },
  { value: "FOR_TIME", label: "For Time" },
  { value: "CHIPPER", label: "Chipper" },
  { value: "DENSITY", label: "Density" },
  { value: "RELAY", label: "Relay" },
  { value: "SETS_REPS", label: "Sets/Reps" },
  { value: "CUSTOM", label: "Custom" },
];

const DEFAULT_AI_PROMPT = `Act as a strength and conditioning coach designing the next 6-week block for Iron Acre Gym.

Iron Acre is a rural outdoor fitness facility combining:
- Brian Alsruhe Every Day Carry principles
- Nuclear Fit / OCR style fitness
- Strongman-inspired training
- Functional real-world strength

The identity is:
MOVE BETTER
CARRY HEAVY THINGS
GET STRONG
WORK HARD

Equipment:
- Sandbags
- Kettlebells
- Farmer carry handles
- Open outdoor space

Do not rely on barbells.

Class format:
- 12 members
- 6 pairs
- Mixed ability
- 60 minute sessions

Weekly schedule:
Monday = Hinge & Carry
Wednesday = Press & Stability
Friday = Squat & Grit
Saturday = Loading & Strongman

Each session should follow:
5 mins mobility flow
5 mins bodyweight prep
12 mins carry/loading block
20 mins strength block
12 mins capacity block
6 mins athletic finisher

Strength should stay the same or similar across the 6 weeks so members can progress.

Capacity and athletic finishers should change weekly with genuinely different stimuli:
- E3MOM
- E2MOM
- AMRAP
- Chipper
- Relay
- Partner accumulation
- I Go You Go
- Density block
- OCR style event work

Avoid Russian twists.

Use core work such as:
- Deadbugs
- Pull throughs
- V-Ups
- Full body crunches
- Hollow holds
- Side planks
- Carries
- Holds

Make the plan feel like Brian Alsruhe + Nuclear Fit + Strongman + Iron Acre, not generic bootcamp or CrossFit.`;

function stripBullet(line: string): string {
  return line
    .replace(/^\s*[-*•]\s*/g, "")
    .replace(/^\s*\d+[.)]\s*/g, "")
    .trim();
}

function cleanHeading(line: string): string {
  return line.replace(/^#+\s*/g, "").trim();
}

function parseDayHeading(line: string): { dayName: WorkoutDayName; theme?: string } | null {
  const cleaned = cleanHeading(line);
  const match = cleaned.match(
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b\s*[-:–]?\s*(.*)$/i
  );

  if (!match) return null;

  const dayName = DAY_NAMES.find((d) => d.toLowerCase() === match[1].toLowerCase());
  if (!dayName) return null;

  return {
    dayName,
    theme: String(match[2] || "").trim() || undefined,
  };
}

function parseWeekHeading(line: string): { weekNumber: number; theme?: string } | null {
  const cleaned = cleanHeading(line);
  const match = cleaned.match(/^WEEK\s+(\d+)\s*[-:]?\s*(.*)$/i);

  if (!match) return null;

  const weekNumber = Number(match[1]);
  if (!Number.isFinite(weekNumber) || weekNumber < 1) return null;

  return {
    weekNumber,
    theme: String(match[2] || "").trim() || undefined,
  };
}

function getSectionFromLine(line: string): DaySectionKey | null {
  const cleaned = cleanHeading(line).toLowerCase();

  if (cleaned.includes("strength")) return "strength";
  if (cleaned.includes("work capacity")) return "capacity";
  if (cleaned.includes("capacity")) return "capacity";
  if (cleaned.includes("finisher")) return "athletic";
  if (cleaned.includes("athletic")) return "athletic";
  if (cleaned.includes("notes")) return "notes";
  if (cleaned.includes("coaching")) return "notes";

  return null;
}

function textToLines(value: string): string[] {
  return String(value || "")
    .split("\n")
    .map((x) => stripBullet(x))
    .filter(Boolean);
}

function linesToText(lines: string[]): string {
  return (Array.isArray(lines) ? lines : []).join("\n");
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function createDefaultSection(title: string, scheme: ProgrammeScheme | null, schemeLabel: string, durationMinutes: number | null): ProgrammeSection {
  return {
    title,
    scheme,
    schemeLabel,
    durationMinutes,
    rounds: null,
    instructions: [],
    exercises: [],
  };
}

function defaultDayTheme(dayName: WorkoutDayName): string {
  if (dayName === "Monday") return "Hinge & Carry";
  if (dayName === "Wednesday") return "Press & Stability";
  if (dayName === "Friday") return "Squat & Grit";
  if (dayName === "Saturday") return "Loading & Strongman";
  return "";
}

function createDefaultDay(dayName: WorkoutDayName): WorkoutDay {
  return {
    dayName,
    theme: defaultDayTheme(dayName),
    strength: [],
    capacity: [],
    athletic: [],
    notes: [],
    raw: "",
    sections: {
      strength: createDefaultSection("Strength", "E5MOM", "E5MOM x 4", 20),
      capacity: createDefaultSection("Capacity", "E3MOM", "E3MOM x 4", 12),
      athletic: createDefaultSection("Athletic", "CUSTOM", "", 6),
      notes: createDefaultSection("Notes", "CUSTOM", "", null),
    },
  };
}

function createEmptyWeeks(): WeekPlan[] {
  return Array.from({ length: 6 }).map((_, index) => ({
    weekNumber: index + 1,
    theme: "",
    raw: "",
    days: DEFAULT_TRAINING_DAYS.map((day) => createDefaultDay(day)),
  }));
}

function lineToExercise(line: string): ProgrammeExercise {
  return {
    name: line,
    reps: "",
    notes: null,
    tracked: false,
    strength_exercise_id: null,
  };
}

function sectionToLines(section?: ProgrammeSection): string[] {
  if (!section) return [];

  const output: string[] = [];

  if (section.schemeLabel) output.push(section.schemeLabel);
  else if (section.scheme && section.scheme !== "CUSTOM") output.push(section.scheme);

  if (section.durationMinutes) output.push(`${section.durationMinutes} mins`);

  if (Array.isArray(section.instructions)) {
    output.push(...section.instructions.filter(Boolean));
  }

  if (Array.isArray(section.exercises)) {
    for (const ex of section.exercises) {
      const parts = [ex.name];

      if (ex.reps) parts.push(ex.reps);
      if (ex.notes) parts.push(`- ${ex.notes}`);

      const label = parts.filter(Boolean).join(" ");
      if (label) output.push(label);
    }
  }

  return output.filter(Boolean);
}

function normaliseProgrammeExercise(input: any): ProgrammeExercise | null {
  const name = String(input?.name || input?.exercise_name || "").trim();
  if (!name) return null;

  return {
    id: String(input?.id || "").trim() || undefined,
    name,
    reps: String(input?.reps || "").trim() || "",
    notes: String(input?.notes || "").trim() || null,
    tracked: input?.tracked === true || String(input?.tracked || "").toLowerCase() === "true",
    strength_exercise_id: String(input?.strength_exercise_id || "").trim() || null,
  };
}

function normaliseProgrammeSection(input: any, fallback: ProgrammeSection): ProgrammeSection {
  if (!input || typeof input !== "object") return fallback;

  const exercises = Array.isArray(input.exercises)
    ? input.exercises
        .map((x: any): ProgrammeExercise | null => normaliseProgrammeExercise(x))
        .filter((x: ProgrammeExercise | null): x is ProgrammeExercise => x !== null)
    : fallback.exercises || [];

  return {
    title: String(input.title || fallback.title || "").trim() || fallback.title,
    scheme: (String(input.scheme || fallback.scheme || "CUSTOM").trim() as ProgrammeScheme) || "CUSTOM",
    schemeLabel: String(input.schemeLabel || input.scheme_label || fallback.schemeLabel || "").trim(),
    durationMinutes: toNullableNumber(input.durationMinutes ?? input.duration_minutes ?? fallback.durationMinutes),
    rounds: toNullableNumber(input.rounds ?? fallback.rounds),
    instructions: Array.isArray(input.instructions) ? textToLines(input.instructions.join("\n")) : fallback.instructions || [],
    exercises,
  };
}

function normaliseDaySections(day: Partial<WorkoutDay>, dayName: WorkoutDayName): WorkoutDaySections {
  const fallback = createDefaultDay(dayName).sections || {};

  const strengthLines = Array.isArray(day.strength) ? day.strength : [];
  const capacityLines = Array.isArray(day.capacity) ? day.capacity : [];
  const athleticLines = Array.isArray(day.athletic) ? day.athletic : [];
  const noteLines = Array.isArray(day.notes) ? day.notes : [];

  const strengthFallback: ProgrammeSection = {
    ...(fallback.strength || createDefaultSection("Strength", "E5MOM", "E5MOM x 4", 20)),
    exercises: strengthLines.map(lineToExercise),
  };

  const capacityFallback: ProgrammeSection = {
    ...(fallback.capacity || createDefaultSection("Capacity", "E3MOM", "E3MOM x 4", 12)),
    instructions: capacityLines,
  };

  const athleticFallback: ProgrammeSection = {
    ...(fallback.athletic || createDefaultSection("Athletic", "CUSTOM", "", 6)),
    instructions: athleticLines,
  };

  const notesFallback: ProgrammeSection = {
    ...(fallback.notes || createDefaultSection("Notes", "CUSTOM", "", null)),
    instructions: noteLines,
  };

  const inputSections = day.sections || {};

  return {
    strength: normaliseProgrammeSection(inputSections.strength, strengthFallback),
    capacity: normaliseProgrammeSection(inputSections.capacity, capacityFallback),
    athletic: normaliseProgrammeSection(inputSections.athletic, athleticFallback),
    notes: normaliseProgrammeSection(inputSections.notes, notesFallback),
  };
}

function normaliseDay(input: Partial<WorkoutDay>, dayName: WorkoutDayName): WorkoutDay {
  const sections = normaliseDaySections(input, dayName);

  return {
    dayName,
    theme: input.theme || defaultDayTheme(dayName),
    strength: sectionToLines(sections.strength),
    capacity: sectionToLines(sections.capacity),
    athletic: sectionToLines(sections.athletic),
    notes: sectionToLines(sections.notes),
    raw: String(input.raw || ""),
    sections,
  };
}

function normaliseWeekShape(input: WeekPlan[]): WeekPlan[] {
  const source = Array.isArray(input) && input.length ? input : createEmptyWeeks();

  return source
    .map((week) => {
      const existingDays = Array.isArray(week.days) ? week.days : [];

      const days = DEFAULT_TRAINING_DAYS.map((dayName) => {
        const existing = existingDays.find((day) => day.dayName === dayName);
        return normaliseDay(existing || createDefaultDay(dayName), dayName);
      });

      return {
        weekNumber: Number(week.weekNumber) || 1,
        theme: week.theme || "",
        raw: week.raw || "",
        days,
      };
    })
    .sort((a, b) => a.weekNumber - b.weekNumber);
}

function parseWorkoutText(raw: string): WeekPlan[] {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const lines = text.split("\n");
  const weekStartIndexes: Array<{ index: number; weekNumber: number; theme?: string }> = [];

  lines.forEach((line, index) => {
    const heading = parseWeekHeading(line);

    if (heading) {
      weekStartIndexes.push({
        index,
        weekNumber: heading.weekNumber,
        theme: heading.theme,
      });
    }
  });

  if (!weekStartIndexes.length) {
    return normaliseWeekShape([
      {
        weekNumber: 1,
        theme: "Imported Block",
        raw: text,
        days: parseDaysFromLines(lines),
      },
    ]);
  }

  const weeks: WeekPlan[] = [];

  weekStartIndexes.forEach((weekStart, index) => {
    const next = weekStartIndexes[index + 1];
    const slice = lines.slice(weekStart.index + 1, next ? next.index : lines.length);
    const rawWeek = slice.join("\n").trim();

    weeks.push({
      weekNumber: weekStart.weekNumber,
      theme: weekStart.theme || "",
      raw: rawWeek,
      days: parseDaysFromLines(slice),
    });
  });

  return normaliseWeekShape(weeks);
}

function parseDaysFromLines(lines: string[]): WorkoutDay[] {
  const dayStartIndexes: Array<{ index: number; dayName: WorkoutDayName; theme?: string }> = [];

  lines.forEach((line, index) => {
    const parsed = parseDayHeading(line);

    if (parsed) {
      dayStartIndexes.push({
        index,
        dayName: parsed.dayName,
        theme: parsed.theme,
      });
    }
  });

  if (!dayStartIndexes.length) return [];

  const days: WorkoutDay[] = [];

  dayStartIndexes.forEach((dayStart, index) => {
    const next = dayStartIndexes[index + 1];
    const slice = lines.slice(dayStart.index + 1, next ? next.index : lines.length);
    const rawDay = slice.join("\n").trim();

    const sectionLines: Record<DaySectionKey, string[]> = {
      strength: [],
      capacity: [],
      athletic: [],
      notes: [],
    };

    let section: DaySectionKey = "notes";

    slice.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const nextSection = getSectionFromLine(trimmed);

      if (nextSection) {
        section = nextSection;
        return;
      }

      const cleaned = stripBullet(trimmed);
      if (!cleaned) return;

      sectionLines[section].push(cleaned);
    });

    days.push(
      normaliseDay(
        {
          dayName: dayStart.dayName,
          theme: dayStart.theme || defaultDayTheme(dayStart.dayName),
          strength: sectionLines.strength,
          capacity: sectionLines.capacity,
          athletic: sectionLines.athletic,
          notes: sectionLines.notes,
          raw: rawDay,
        },
        dayStart.dayName
      )
    );
  });

  return days;
}

function generateRawTextFromWeeks(weeks: WeekPlan[]): string {
  return weeks
    .map((week) => {
      const weekTitle = `WEEK ${week.weekNumber}${week.theme ? ` - ${week.theme}` : ""}`;

      const daysText = week.days
        .map((day) => {
          const title = `${day.dayName}${day.theme ? ` - ${day.theme}` : ""}`;

          const section = (label: string, lines: string[]) => {
            if (!lines.length) return "";
            return `${label}\n${lines.map((line) => `- ${line}`).join("\n")}`;
          };

          return [
            title,
            section("Strength", day.strength),
            section("Capacity", day.capacity),
            section("Athletic", day.athletic),
            section("Notes", day.notes),
          ]
            .filter(Boolean)
            .join("\n\n");
        })
        .join("\n\n");

      return [weekTitle, daysText].filter(Boolean).join("\n\n");
    })
    .join("\n\n");
}

function normaliseBlocks(raw: unknown): WorkoutBlock[] {
  const obj = raw as any;

  const arr =
    (Array.isArray(obj?.blocks) && obj.blocks) ||
    (Array.isArray(obj?.items) && obj.items) ||
    (Array.isArray(obj?.data) && obj.data) ||
    [];

  return arr
    .map((x: any): WorkoutBlock | null => {
      const blockId = String(x?.block_id || x?.id || "").trim();
      if (!blockId) return null;

      return {
        block_id: blockId,
        title: String(x?.title || x?.name || "Untitled block").trim(),
        focus: x?.focus ?? null,
        ai_prompt: x?.ai_prompt ?? null,
        raw_text: String(x?.raw_text || ""),
        weeks: Array.isArray(x?.weeks) ? normaliseWeekShape(x.weeks) : [],
        tracked_strength_exercises: Array.isArray(x?.tracked_strength_exercises)
          ? x.tracked_strength_exercises
          : [],
        created_by: x?.created_by ?? null,
        created_at: x?.created_at ?? null,
        updated_at: x?.updated_at ?? null,
      };
    })
    .filter((x: WorkoutBlock | null): x is WorkoutBlock => x !== null);
}

function SectionPreview({
  title,
  section,
  fallbackItems,
}: {
  title: string;
  section?: ProgrammeSection;
  fallbackItems: string[];
}) {
  const items = section ? sectionToLines(section) : fallbackItems;

  if (!items.length) return null;

  return (
    <div className="ia-block-section">
      <div className="ia-block-section-title">{title}</div>

      {section?.schemeLabel || section?.durationMinutes ? (
        <div className="ia-scheme-preview">
          {section.schemeLabel ? <span>{section.schemeLabel}</span> : null}
          {section.durationMinutes ? <small>{section.durationMinutes} mins</small> : null}
        </div>
      ) : null}

      <ul className="ia-block-list">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DayPreviewCard({ day }: { day: WorkoutDay }) {
  return (
    <div className="ia-preview-day-card">
      <div className="ia-day-name">{day.dayName}</div>
      {day.theme ? <div className="ia-day-theme">{day.theme}</div> : null}

      <SectionPreview title="Strength" section={day.sections?.strength} fallbackItems={day.strength} />
      <SectionPreview title="Capacity" section={day.sections?.capacity} fallbackItems={day.capacity} />
      <SectionPreview title="Athletic" section={day.sections?.athletic} fallbackItems={day.athletic} />
      <SectionPreview title="Notes" section={day.sections?.notes} fallbackItems={day.notes} />
    </div>
  );
}

function makeExerciseId(): string {
  return `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function WorkoutBlocksPage() {
  const { data: session, status } = useSession();

  const ownerEmail = (session?.user?.email || "").toLowerCase();
  const role = (session?.user as any)?.role || "user";

  const { data, mutate, isLoading } = useSWR<BlocksResponse>("/api/workout-blocks?limit=50", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const blocks = useMemo(() => normaliseBlocks(data), [data]);

  const [editingBlockId, setEditingBlockId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT);
  const [draftWeeks, setDraftWeeks] = useState<WeekPlan[]>(createEmptyWeeks());
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(1);
  const [rawImportText, setRawImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const editingBlock = useMemo(() => {
    if (!editingBlockId) return null;
    return blocks.find((b) => b.block_id === editingBlockId) || null;
  }, [blocks, editingBlockId]);

  const generatedRawText = useMemo(() => generateRawTextFromWeeks(draftWeeks), [draftWeeks]);

  const selectedWeek = useMemo(() => {
    return (
      draftWeeks.find((w) => Number(w.weekNumber) === Number(selectedWeekNumber)) ||
      draftWeeks[0] ||
      null
    );
  }, [draftWeeks, selectedWeekNumber]);

  useEffect(() => {
    if (!editingBlock) return;

    const weeksFromBlock =
      Array.isArray(editingBlock.weeks) && editingBlock.weeks.length
        ? normaliseWeekShape(editingBlock.weeks)
        : parseWorkoutText(editingBlock.raw_text || "");

    setTitle(editingBlock.title || "");
    setFocus(editingBlock.focus || "");
    setAiPrompt(editingBlock.ai_prompt || DEFAULT_AI_PROMPT);
    setDraftWeeks(weeksFromBlock.length ? weeksFromBlock : createEmptyWeeks());
    setSelectedWeekNumber(1);
    setRawImportText(editingBlock.raw_text || "");
    setShowImport(false);
    setShowRawText(false);
    setSaveError(null);
    setSaveOk(null);
  }, [editingBlock]);

  function handleNewBlock() {
    setEditingBlockId("");
    setTitle("");
    setFocus("");
    setAiPrompt(DEFAULT_AI_PROMPT);
    setDraftWeeks(createEmptyWeeks());
    setSelectedWeekNumber(1);
    setRawImportText("");
    setShowImport(false);
    setShowRawText(false);
    setSaveError(null);
    setSaveOk(null);
  }

  function rebuildDayFromSections(day: WorkoutDay): WorkoutDay {
    const sections = normaliseDaySections(day, day.dayName);

    return {
      ...day,
      sections,
      strength: sectionToLines(sections.strength),
      capacity: sectionToLines(sections.capacity),
      athletic: sectionToLines(sections.athletic),
      notes: sectionToLines(sections.notes),
    };
  }

  function updateDay(
    weekNumber: number,
    dayName: WorkoutDayName,
    updater: (day: WorkoutDay) => WorkoutDay
  ) {
    setDraftWeeks((prev) =>
      prev.map((week) =>
        week.weekNumber === weekNumber
          ? {
              ...week,
              days: week.days.map((day) =>
                day.dayName === dayName ? rebuildDayFromSections(updater(day)) : day
              ),
            }
          : week
      )
    );
  }

  function updateWeekTheme(weekNumber: number, theme: string) {
    setDraftWeeks((prev) =>
      prev.map((week) =>
        week.weekNumber === weekNumber
          ? {
              ...week,
              theme,
            }
          : week
      )
    );
  }

  function updateDayTheme(weekNumber: number, dayName: WorkoutDayName, theme: string) {
    updateDay(weekNumber, dayName, (day) => ({
      ...day,
      theme,
    }));
  }

  function updateSectionMeta(
    weekNumber: number,
    dayName: WorkoutDayName,
    section: DaySectionKey,
    patch: Partial<ProgrammeSection>
  ) {
    updateDay(weekNumber, dayName, (day) => {
      const sections = normaliseDaySections(day, day.dayName);
      const current = normaliseProgrammeSection((sections as any)[section], createDefaultSection(section, "CUSTOM", "", null));

      return {
        ...day,
        sections: {
          ...sections,
          {
            ...current,
            ...patch,
          },
        },
      };
    });
  }

  function updateSectionInstructions(
    weekNumber: number,
    dayName: WorkoutDayName,
    section: Exclude<DaySectionKey, "strength">,
    value: string
  ) {
    updateSectionMeta(weekNumber, dayName, section, {
      instructions: textToLines(value),
    });
  }

  function addStrengthExercise(weekNumber: number, dayName: WorkoutDayName) {
    updateDay(weekNumber, dayName, (day) => {
      const sections = normaliseDaySections(day, day.dayName);
      const strength = normaliseProgrammeSection(
        sections.strength,
        createDefaultSection("Strength", "E5MOM", "E5MOM x 4", 20)
      );

      return {
        ...day,
        sections: {
          ...sections,
          strength: {
            ...strength,
            exercises: [
              ...(strength.exercises || []),
              {
                id: makeExerciseId(),
                name: "",
                reps: "",
                notes: null,
                tracked: false,
                strength_exercise_id: null,
              },
            ],
          },
        },
      };
    });
  }

  function updateStrengthExercise(
    weekNumber: number,
    dayName: WorkoutDayName,
    index: number,
    patch: Partial<ProgrammeExercise>
  ) {
    updateDay(weekNumber, dayName, (day) => {
      const sections = normaliseDaySections(day, day.dayName);
      const strength = normaliseProgrammeSection(
        sections.strength,
        createDefaultSection("Strength", "E5MOM", "E5MOM x 4", 20)
      );

      const exercises = [...(strength.exercises || [])];

      exercises[index] = {
        ...(exercises[index] || {
          id: makeExerciseId(),
          name: "",
          reps: "",
          tracked: false,
          strength_exercise_id: null,
        }),
        ...patch,
      };

      return {
        ...day,
        sections: {
          ...sections,
          strength: {
            ...strength,
            exercises,
          },
        },
      };
    });
  }

  function removeStrengthExercise(weekNumber: number, dayName: WorkoutDayName, index: number) {
    updateDay(weekNumber, dayName, (day) => {
      const sections = normaliseDaySections(day, day.dayName);
      const strength = normaliseProgrammeSection(
        sections.strength,
        createDefaultSection("Strength", "E5MOM", "E5MOM x 4", 20)
      );

      const exercises = (strength.exercises || []).filter((_, i) => i !== index);

      return {
        ...day,
        sections: {
          ...sections,
          strength: {
            ...strength,
            exercises,
          },
        },
      };
    });
  }

  function handleImportText() {
    const parsed = parseWorkoutText(rawImportText);

    if (!parsed.length) {
      setSaveError(
        "Could not parse that text. Make sure it contains WEEK 1, Monday, Strength, Capacity and Athletic headings."
      );
      setSaveOk(null);
      return;
    }

    setDraftWeeks(parsed);
    setSelectedWeekNumber(1);
    setShowImport(false);
    setSaveOk("Imported text into the editor.");
    setSaveError(null);
  }

  async function handleSave() {
    setSaveError(null);
    setSaveOk(null);

    const safeTitle = title.trim();

    if (!safeTitle) {
      setSaveError("Add a block title first.");
      return;
    }

    const cleanWeeks = normaliseWeekShape(draftWeeks);
    const rawText = generateRawTextFromWeeks(cleanWeeks);

    setSaving(true);

    try {
      const isUpdate = Boolean(editingBlockId);

      const resp = await fetch("/api/workout-blocks", {
        method: isUpdate ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          block_id: editingBlockId || undefined,
          title: safeTitle,
          focus: focus.trim() || null,
          ai_prompt: aiPrompt.trim() || null,
          raw_text: rawText,
          weeks: cleanWeeks,
          created_by: ownerEmail || null,
        }),
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json?.error || "Failed to save workout block");
      }

      const savedId = String(json?.block_id || editingBlockId || "");

      setDraftWeeks(cleanWeeks);
      setRawImportText(rawText);
      setSaveOk(isUpdate ? "Workout block updated." : "Workout block saved.");
      setEditingBlockId(savedId);
      setSelectedWeekNumber(1);

      await mutate();
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save workout block");
    } finally {
      setSaving(false);
    }
  }

  async function copyPromptToClipboard() {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      setSaveOk("AI prompt copied.");
      setSaveError(null);
    } catch {
      setSaveError("Could not copy prompt.");
      setSaveOk(null);
    }
  }

  async function copyRawTextToClipboard() {
    try {
      await navigator.clipboard.writeText(generatedRawText);
      setSaveOk("Workout text copied.");
      setSaveError(null);
    } catch {
      setSaveError("Could not copy workout text.");
      setSaveOk(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="container py-4 text-white">
        <div className="ia-tile ia-tile-pad">
          <div className="text-dim">Checking access…</div>
        </div>
      </div>
    );
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4 text-white">
        <div className="ia-tile ia-tile-pad">
          <div className="ia-page-title">Access denied</div>
          <div className="ia-page-subtitle">You do not have permission to view this page.</div>
          <div className="mt-3">
            <Link href="/admin">Back to admin</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Workout Blocks • Admin</title>
      </Head>

      <main className="container py-3 text-white ia-block-page" style={{ paddingBottom: 90 }}>
        <div className="ia-top-row">
          <Link href="/admin">← Back to admin</Link>

          <div className="ia-top-actions">
            <button type="button" className="ia-btn ia-btn-outline" onClick={handleNewBlock}>
              New block
            </button>

            <button type="button" className="ia-btn ia-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingBlockId ? "Update block" : "Save block"}
            </button>
          </div>
        </div>

        <div className="ia-page-title">Workout blocks</div>
        <div className="ia-page-subtitle">
          Build programme blocks, define schemes, tick tracked strength lifts and save them into Firestore.
        </div>

        {saveError ? <div className="ia-alert ia-alert-error">{saveError}</div> : null}
        {saveOk ? <div className="ia-alert ia-alert-ok">{saveOk}</div> : null}

        <section className="ia-tile ia-tile-pad ia-block-picker">
          <div className="ia-panel-row">
            <div>
              <div className="ia-panel-title">Saved blocks</div>
              <div className="text-dim">Click a block to load it into the editor.</div>
            </div>

            {isLoading ? <div className="text-dim">Loading…</div> : null}
          </div>

          {!isLoading && !blocks.length ? <div className="text-dim mt-2">No saved workout blocks yet.</div> : null}

          {blocks.length ? (
            <div className="ia-block-tabs">
              {blocks.map((block) => {
                const active = editingBlockId === block.block_id;

                return (
                  <button
                    key={block.block_id}
                    type="button"
                    className={`ia-block-tab ${active ? "active" : ""}`}
                    onClick={() => setEditingBlockId(block.block_id)}
                  >
                    <span>{block.title}</span>
                    {block.focus ? <small>{block.focus}</small> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="ia-tile ia-tile-pad ia-meta-panel">
          <div className="ia-panel-title">{editingBlockId ? "Editing block" : "New block"}</div>

          <div className="ia-meta-grid">
            <label className="ia-label">
              Block title
              <input
                className="ia-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Farm Strong Block 1"
              />
            </label>

            <label className="ia-label">
              Focus
              <input
                className="ia-input"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Strength base, carries, OCR fitness"
              />
            </label>
          </div>
        </section>

        <section className="ia-layout">
          <div className="ia-tile ia-tile-pad ia-editor-panel">
            <div className="ia-panel-row">
              <div>
                <div className="ia-panel-title">Structured editor</div>
                <div className="text-dim">Strength now uses editable rows with tracking support.</div>
              </div>

              <button type="button" className="ia-btn ia-btn-outline" onClick={() => setShowImport((v) => !v)}>
                {showImport ? "Hide import" : "Import text"}
              </button>
            </div>

            {showImport ? (
              <div className="ia-import-box">
                <label className="ia-label">
                  Paste generated workout text
                  <textarea
                    className="ia-textarea ia-import-textarea"
                    value={rawImportText}
                    onChange={(e) => setRawImportText(e.target.value)}
                    placeholder="Paste the full 6-week block here, then click import."
                  />
                </label>

                <button type="button" className="ia-btn ia-btn-primary" onClick={handleImportText}>
                  Import into editor
                </button>
              </div>
            ) : null}

            <div className="ia-week-tabs">
              {draftWeeks.map((week) => (
                <button
                  key={week.weekNumber}
                  type="button"
                  className={`ia-week-tab ${selectedWeekNumber === week.weekNumber ? "active" : ""}`}
                  onClick={() => setSelectedWeekNumber(week.weekNumber)}
                >
                  Week {week.weekNumber}
                </button>
              ))}
            </div>

            {selectedWeek ? (
              <>
                <label className="ia-label">
                  Week theme
                  <input
                    className="ia-input"
                    value={selectedWeek.theme || ""}
                    onChange={(e) => updateWeekTheme(selectedWeek.weekNumber, e.target.value)}
                    placeholder="Foundation Week"
                  />
                </label>

                <div className="ia-day-editor-grid">
                  {selectedWeek.days.map((day) => {
                    const sections = normaliseDaySections(day, day.dayName);
                    const strength = normaliseProgrammeSection(
                      sections.strength,
                      createDefaultSection("Strength", "E5MOM", "E5MOM x 4", 20)
                    );
                    const capacity = normaliseProgrammeSection(
                      sections.capacity,
                      createDefaultSection("Capacity", "E3MOM", "E3MOM x 4", 12)
                    );
                    const athletic = normaliseProgrammeSection(
                      sections.athletic,
                      createDefaultSection("Athletic", "CUSTOM", "", 6)
                    );
                    const notes = normaliseProgrammeSection(
                      sections.notes,
                      createDefaultSection("Notes", "CUSTOM", "", null)
                    );

                    return (
                      <div key={`${selectedWeek.weekNumber}-${day.dayName}`} className="ia-day-editor-card">
                        <div className="ia-day-editor-head">
                          <div>
                            <div className="ia-day-name">{day.dayName}</div>
                            <div className="ia-day-theme">{day.theme}</div>
                          </div>
                        </div>

                        <label className="ia-label">
                          Theme
                          <input
                            className="ia-input"
                            value={day.theme || ""}
                            onChange={(e) => updateDayTheme(selectedWeek.weekNumber, day.dayName, e.target.value)}
                            placeholder="Hinge & Carry"
                          />
                        </label>

                        <div className="ia-programme-section">
                          <div className="ia-programme-title">Strength</div>

                          <div className="ia-scheme-grid">
                            <label className="ia-label">
                              Scheme
                              <select
                                className="ia-input"
                                value={strength.scheme || "CUSTOM"}
                                onChange={(e) =>
                                  updateSectionMeta(selectedWeek.weekNumber, day.dayName, "strength", {
                                    scheme: e.target.value as ProgrammeScheme,
                                  })
                                }
                              >
                                {SCHEME_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="ia-label">
                              Display label
                              <input
                                className="ia-input"
                                value={strength.schemeLabel || ""}
                                onChange={(e) =>
                                  updateSectionMeta(selectedWeek.weekNumber, day.dayName, "strength", {
                                    schemeLabel: e.target.value,
                                  })
                                }
                                placeholder="E5MOM x 4"
                              />
                            </label>

                            <label className="ia-label">
                              Minutes
                              <input
                                className="ia-input"
                                type="number"
                                min={0}
                                value={strength.durationMinutes ?? ""}
                                onChange={(e) =>
                                  updateSectionMeta(selectedWeek.weekNumber, day.dayName, "strength", {
                                    durationMinutes: toNullableNumber(e.target.value),
                                  })
                                }
                                placeholder="20"
                              />
                            </label>
                          </div>

                          <div className="ia-exercise-table">
                            {(strength.exercises || []).map((exercise, index) => (
                              <div key={exercise.id || `${day.dayName}-strength-${index}`} className="ia-exercise-row">
                                <label className="ia-track-check">
                                  <input
                                    type="checkbox"
                                    checked={!!exercise.tracked}
                                    onChange={(e) =>
                                      updateStrengthExercise(selectedWeek.weekNumber, day.dayName, index, {
                                        tracked: e.target.checked,
                                      })
                                    }
                                  />
                                  <span>Track</span>
                                </label>

                                <input
                                  className="ia-input"
                                  value={exercise.name}
                                  onChange={(e) =>
                                    updateStrengthExercise(selectedWeek.weekNumber, day.dayName, index, {
                                      name: e.target.value,
                                    })
                                  }
                                  placeholder="Sandbag Deadlift"
                                />

                                <input
                                  className="ia-input"
                                  value={exercise.reps || ""}
                                  onChange={(e) =>
                                    updateStrengthExercise(selectedWeek.weekNumber, day.dayName, index, {
                                      reps: e.target.value,
                                    })
                                  }
                                  placeholder="x8"
                                />

                                <button
                                  type="button"
                                  className="ia-mini-btn"
                                  onClick={() => removeStrengthExercise(selectedWeek.weekNumber, day.dayName, index)}
                                >
                                  Remove
                                </button>

                                {exercise.strength_exercise_id ? (
                                  <div className="ia-match-pill">Matched: {exercise.strength_exercise_id}</div>
                                ) : exercise.tracked ? (
                                  <div className="ia-match-pill ia-match-pending">Will match/create on save</div>
                                ) : null}
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            className="ia-btn ia-btn-outline ia-add-row-btn"
                            onClick={() => addStrengthExercise(selectedWeek.weekNumber, day.dayName)}
                          >
                            Add strength exercise
                          </button>
                        </div>

                        <div className="ia-programme-section">
                          <div className="ia-programme-title">Capacity</div>

                          <div className="ia-scheme-grid">
                            <label className="ia-label">
                              Scheme
                              <select
                                className="ia-input"
                                value={capacity.scheme || "CUSTOM"}
                                onChange={(e) =>
                                  updateSectionMeta(selectedWeek.weekNumber, day.dayName, "capacity", {
                                    scheme: e.target.value as ProgrammeScheme,
                                  })
                                }
                              >
                                {SCHEME_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="ia-label">
                              Display label
                              <input
                                className="ia-input"
                                value={capacity.schemeLabel || ""}
                                onChange={(e) =>
                                  updateSectionMeta(selectedWeek.weekNumber, day.dayName, "capacity", {
                                    schemeLabel: e.target.value,
                                  })
                                }
                                placeholder="E3MOM x 4"
                              />
                            </label>

                            <label className="ia-label">
                              Minutes
                              <input
                                className="ia-input"
                                type="number"
                                min={0}
                                value={capacity.durationMinutes ?? ""}
                                onChange={(e) =>
                                  updateSectionMeta(selectedWeek.weekNumber, day.dayName, "capacity", {
                                    durationMinutes: toNullableNumber(e.target.value),
                                  })
                                }
                                placeholder="12"
                              />
                            </label>
                          </div>

                          <label className="ia-label">
                            Instructions
                            <textarea
                              className="ia-textarea ia-section-textarea"
                              value={linesToText(capacity.instructions || [])}
                              onChange={(e) =>
                                updateSectionInstructions(selectedWeek.weekNumber, day.dayName, "capacity", e.target.value)
                              }
                              placeholder={`6 Ground To Shoulder
40m Farmer Carry
8 Burpees`}
                            />
                          </label>
                        </div>

                        <div className="ia-programme-section">
                          <div className="ia-programme-title">Athletic</div>

                          <div className="ia-scheme-grid">
                            <label className="ia-label">
                              Scheme
                              <select
                                className="ia-input"
                                value={athletic.scheme || "CUSTOM"}
                                onChange={(e) =>
                                  updateSectionMeta(selectedWeek.weekNumber, day.dayName, "athletic", {
                                    scheme: e.target.value as ProgrammeScheme,
                                  })
                                }
                              >
                                {SCHEME_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="ia-label">
                              Display label
                              <input
                                className="ia-input"
                                value={athletic.schemeLabel || ""}
                                onChange={(e) =>
                                  updateSectionMeta(selectedWeek.weekNumber, day.dayName, "athletic", {
                                    schemeLabel: e.target.value,
                                  })
                                }
                                placeholder="21-15-9"
                              />
                            </label>

                            <label className="ia-label">
                              Minutes
                              <input
                                className="ia-input"
                                type="number"
                                min={0}
                                value={athletic.durationMinutes ?? ""}
                                onChange={(e) =>
                                  updateSectionMeta(selectedWeek.weekNumber, day.dayName, "athletic", {
                                    durationMinutes: toNullableNumber(e.target.value),
                                  })
                                }
                                placeholder="6"
                              />
                            </label>
                          </div>

                          <label className="ia-label">
                            Instructions
                            <textarea
                              className="ia-textarea ia-section-textarea"
                              value={linesToText(athletic.instructions || [])}
                              onChange={(e) =>
                                updateSectionInstructions(selectedWeek.weekNumber, day.dayName, "athletic", e.target.value)
                              }
                              placeholder={`KB Swings
Full Body Crunches`}
                            />
                          </label>
                        </div>

                        <label className="ia-label">
                          Notes
                          <textarea
                            className="ia-textarea ia-section-textarea ia-notes-textarea"
                            value={linesToText(notes.instructions || [])}
                            onChange={(e) =>
                              updateSectionInstructions(selectedWeek.weekNumber, day.dayName, "notes", e.target.value)
                            }
                            placeholder="Scaling, coaching notes, equipment notes."
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>

          <aside className="ia-tile ia-tile-pad ia-preview-panel">
            <div className="ia-panel-row">
              <div>
                <div className="ia-panel-title">Preview</div>
                <div className="text-dim">This is how the week will display to members.</div>
              </div>

              <button type="button" className="ia-btn ia-btn-outline" onClick={copyRawTextToClipboard}>
                Copy text
              </button>
            </div>

            {selectedWeek ? (
              <div className="ia-week-preview">
                <div className="ia-week-title">
                  Week {selectedWeek.weekNumber}
                  {selectedWeek.theme ? <span> - {selectedWeek.theme}</span> : null}
                </div>

                <div className="ia-preview-days">
                  {selectedWeek.days.map((day) => (
                    <DayPreviewCard key={`preview-${selectedWeek.weekNumber}-${day.dayName}`} day={day} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="ia-empty-preview">Select a week to preview.</div>
            )}

            <div className="ia-raw-toggle-row">
              <button type="button" className="ia-btn ia-btn-outline" onClick={() => setShowRawText((v) => !v)}>
                {showRawText ? "Hide raw text" : "Show raw text"}
              </button>
            </div>

            {showRawText ? <pre className="ia-raw-week">{generatedRawText}</pre> : null}
          </aside>
        </section>

        <section className="ia-tile ia-tile-pad ia-ai-panel">
          <div className="ia-panel-row">
            <div>
              <div className="ia-panel-title">AI prompt template</div>
              <div className="text-dim">Keep this at the bottom. Copy it when you want to generate the next block.</div>
            </div>

            <button type="button" className="ia-btn ia-btn-outline" onClick={copyPromptToClipboard}>
              Copy AI prompt
            </button>
          </div>

          <label className="ia-label">
            Prompt
            <textarea
              className="ia-textarea ia-prompt-textarea"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Paste or edit your reusable prompt here."
            />
          </label>
        </section>
      </main>

      <BottomNav />

      <style jsx>{`
        .ia-block-page {
          max-width: 1320px;
        }

        .ia-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .ia-top-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .ia-block-picker,
        .ia-meta-panel,
        .ia-editor-panel,
        .ia-preview-panel,
        .ia-ai-panel {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(circle at top left, rgba(245, 130, 32, 0.12), transparent 34%),
            rgba(12, 16, 13, 0.92);
        }

        .ia-block-picker,
        .ia-meta-panel {
          margin-top: 16px;
        }

        .ia-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(380px, 0.85fr);
          gap: 18px;
          margin-top: 18px;
          align-items: start;
        }

        .ia-ai-panel {
          margin-top: 18px;
        }

        .ia-panel-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .ia-panel-title {
          font-size: 1.05rem;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .ia-meta-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 14px;
        }

        .ia-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 750;
          color: rgba(255, 255, 255, 0.84);
          margin-bottom: 12px;
        }

        .ia-input,
        .ia-textarea {
          width: 100%;
          margin-top: 7px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.28);
          color: #fff;
          outline: none;
          padding: 12px 13px;
          font-size: 0.95rem;
        }

        .ia-input:focus,
        .ia-textarea:focus {
          border-color: rgba(245, 130, 32, 0.65);
          box-shadow: 0 0 0 3px rgba(245, 130, 32, 0.12);
        }

        .ia-textarea {
          resize: vertical;
          line-height: 1.45;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            "Liberation Mono",
            "Courier New",
            monospace;
        }

        .ia-import-box {
          border: 1px solid rgba(245, 130, 32, 0.22);
          background: rgba(245, 130, 32, 0.06);
          border-radius: 18px;
          padding: 14px;
          margin-bottom: 14px;
        }

        .ia-import-textarea {
          min-height: 260px;
        }

        .ia-section-textarea {
          min-height: 100px;
          font-size: 0.9rem;
        }

        .ia-notes-textarea {
          min-height: 78px;
        }

        .ia-prompt-textarea {
          min-height: 260px;
        }

        .ia-block-tabs {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 10px 0 4px;
        }

        .ia-block-tab {
          min-width: 190px;
          text-align: left;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: #fff;
          border-radius: 16px;
          padding: 12px;
          cursor: pointer;
        }

        .ia-block-tab.active {
          border-color: rgba(245, 130, 32, 0.7);
          background: rgba(245, 130, 32, 0.15);
        }

        .ia-block-tab span {
          display: block;
          font-weight: 850;
          line-height: 1.15;
        }

        .ia-block-tab small {
          display: block;
          margin-top: 5px;
          color: rgba(255, 255, 255, 0.62);
          line-height: 1.25;
        }

        .ia-week-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 8px;
          margin: 10px 0 14px;
        }

        .ia-week-tab {
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.82);
          border-radius: 999px;
          padding: 8px 13px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .ia-week-tab.active {
          color: #111;
          background: #f58220;
          border-color: #f58220;
        }

        .ia-day-editor-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-top: 14px;
        }

        .ia-day-editor-card,
        .ia-preview-day-card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          border-radius: 18px;
          padding: 14px;
          min-width: 0;
        }

        .ia-day-editor-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 10px;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ia-day-name {
          font-weight: 950;
          font-size: 1.05rem;
          letter-spacing: -0.02em;
        }

        .ia-day-theme {
          color: rgba(255, 255, 255, 0.62);
          font-weight: 700;
          font-size: 0.9rem;
          margin-top: 2px;
        }

        .ia-programme-section {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.18);
          border-radius: 16px;
          padding: 12px;
          margin-bottom: 14px;
        }

        .ia-programme-title {
          font-size: 0.88rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #ffb66f;
          font-weight: 950;
          margin-bottom: 10px;
        }

        .ia-scheme-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(90px, 0.5fr);
          gap: 10px;
        }

        .ia-exercise-table {
          display: grid;
          gap: 10px;
          margin-top: 8px;
        }

        .ia-exercise-row {
          display: grid;
          grid-template-columns: 88px minmax(0, 1.2fr) minmax(90px, 0.45fr) auto;
          gap: 8px;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
          border-radius: 14px;
          padding: 10px;
        }

        .ia-track-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 0.85rem;
          font-weight: 800;
          margin: 0;
        }

        .ia-track-check input {
          accent-color: #f58220;
        }

        .ia-mini-btn {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.82);
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .ia-mini-btn:hover {
          background: rgba(255, 255, 255, 0.09);
        }

        .ia-match-pill {
          grid-column: 2 / -1;
          font-size: 0.78rem;
          color: #b7f7c7;
          background: rgba(42, 128, 69, 0.12);
          border: 1px solid rgba(120, 255, 150, 0.14);
          border-radius: 999px;
          padding: 6px 9px;
          width: fit-content;
        }

        .ia-match-pending {
          color: #ffd6a6;
          background: rgba(245, 130, 32, 0.1);
          border-color: rgba(245, 130, 32, 0.22);
        }

        .ia-add-row-btn {
          margin-top: 10px;
        }

        .ia-week-title {
          font-size: 1.35rem;
          font-weight: 900;
          letter-spacing: -0.04em;
          margin-bottom: 12px;
        }

        .ia-week-title span {
          color: rgba(255, 255, 255, 0.66);
          font-weight: 700;
        }

        .ia-preview-days {
          display: grid;
          gap: 12px;
        }

        .ia-block-section {
          margin-top: 12px;
        }

        .ia-block-section-title {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          background: rgba(245, 130, 32, 0.13);
          color: #ffb66f;
          border: 1px solid rgba(245, 130, 32, 0.18);
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 950;
          margin-bottom: 6px;
        }

        .ia-scheme-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }

        .ia-scheme-preview span,
        .ia-scheme-preview small {
          display: inline-flex;
          border-radius: 999px;
          padding: 5px 9px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.78);
          font-weight: 800;
          font-size: 0.78rem;
        }

        .ia-block-list {
          padding-left: 18px;
          margin: 0;
          color: rgba(255, 255, 255, 0.86);
          line-height: 1.42;
        }

        .ia-block-list li {
          margin: 4px 0;
        }

        .ia-raw-toggle-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 14px;
        }

        .ia-raw-week {
          white-space: pre-wrap;
          background: rgba(0, 0, 0, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 12px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 0.85rem;
          line-height: 1.45;
          margin-top: 12px;
          max-height: 420px;
          overflow: auto;
        }

        .ia-alert {
          margin-top: 12px;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 0.9rem;
          font-weight: 750;
        }

        .ia-alert-error {
          background: rgba(180, 40, 40, 0.16);
          color: #ffbdbd;
          border: 1px solid rgba(255, 120, 120, 0.2);
        }

        .ia-alert-ok {
          background: rgba(42, 128, 69, 0.16);
          color: #b7f7c7;
          border: 1px solid rgba(120, 255, 150, 0.18);
        }

        .ia-empty-preview {
          min-height: 260px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: rgba(255, 255, 255, 0.55);
          border: 1px dashed rgba(255, 255, 255, 0.12);
          border-radius: 18px;
        }

        @media (max-width: 1120px) {
          .ia-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .ia-top-row,
          .ia-top-actions,
          .ia-panel-row {
            flex-direction: column;
            align-items: stretch;
          }

          .ia-meta-grid,
          .ia-scheme-grid,
          .ia-exercise-row {
            grid-template-columns: 1fr;
          }

          .ia-match-pill {
            grid-column: auto;
          }

          .ia-block-tab {
            min-width: 170px;
          }
        }
      `}</style>
    </>
  );
}
