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

type WorkoutBlock = {
  block_id: string;
  title: string;
  focus?: string | null;
  ai_prompt?: string | null;
  raw_text: string;
  weeks: WeekPlan[];
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type BlocksResponse = {
  ok: boolean;
  blocks: WorkoutBlock[];
};

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

function getSectionFromLine(line: string): "strength" | "capacity" | "athletic" | "notes" | null {
  const cleaned = cleanHeading(line).toLowerCase();

  if (cleaned.includes("strength")) return "strength";
  if (cleaned.includes("capacity")) return "capacity";
  if (cleaned.includes("work capacity")) return "capacity";
  if (cleaned.includes("finisher")) return "athletic";
  if (cleaned.includes("athletic")) return "athletic";
  if (cleaned.includes("notes")) return "notes";
  if (cleaned.includes("coaching")) return "notes";

  return null;
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
    return [
      {
        weekNumber: 1,
        theme: "Unparsed Block",
        raw: text,
        days: parseDaysFromLines(lines),
      },
    ];
  }

  const weeks: WeekPlan[] = [];

  weekStartIndexes.forEach((weekStart, index) => {
    const next = weekStartIndexes[index + 1];
    const slice = lines.slice(weekStart.index + 1, next ? next.index : lines.length);
    const rawWeek = slice.join("\n").trim();

    weeks.push({
      weekNumber: weekStart.weekNumber,
      theme: weekStart.theme,
      raw: rawWeek,
      days: parseDaysFromLines(slice),
    });
  });

  return weeks.sort((a, b) => a.weekNumber - b.weekNumber);
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

    const day: WorkoutDay = {
      dayName: dayStart.dayName,
      theme: dayStart.theme,
      strength: [],
      capacity: [],
      athletic: [],
      notes: [],
      raw: rawDay,
    };

    let section: "strength" | "capacity" | "athletic" | "notes" = "notes";

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

      day[section].push(cleaned);
    });

    days.push(day);
  });

  return days;
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
        weeks: Array.isArray(x?.weeks) ? x.weeks : [],
        created_by: x?.created_by ?? null,
        created_at: x?.created_at ?? null,
        updated_at: x?.updated_at ?? null,
      };
    })
    .filter((x: WorkoutBlock | null): x is WorkoutBlock => x !== null);
}

function SectionList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;

  return (
    <div className="ia-block-section">
      <div className="ia-block-section-title">{title}</div>
      <ul className="ia-block-list">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DayCard({ day }: { day: WorkoutDay }) {
  return (
    <div className="ia-day-card">
      <div className="ia-day-head">
        <div>
          <div className="ia-day-name">{day.dayName}</div>
          {day.theme ? <div className="ia-day-theme">{day.theme}</div> : null}
        </div>
      </div>

      <SectionList title="Strength" items={day.strength} />
      <SectionList title="Capacity" items={day.capacity} />
      <SectionList title="Athletic" items={day.athletic} />
      <SectionList title="Notes" items={day.notes} />

      {!day.strength.length && !day.capacity.length && !day.athletic.length ? (
        <pre className="ia-raw-day">{day.raw}</pre>
      ) : null}
    </div>
  );
}

function WeekView({ week }: { week: WeekPlan }) {
  return (
    <div className="ia-week-panel">
      <div className="ia-week-title">
        Week {week.weekNumber}
        {week.theme ? <span> - {week.theme}</span> : null}
      </div>

      {week.days.length ? (
        <div className="ia-days-grid">
          {week.days.map((day) => (
            <DayCard key={`${week.weekNumber}-${day.dayName}`} day={day} />
          ))}
        </div>
      ) : (
        <pre className="ia-raw-week">{week.raw}</pre>
      )}
    </div>
  );
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
  const [rawText, setRawText] = useState("");
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const parsedWeeks = useMemo(() => parseWorkoutText(rawText), [rawText]);

  const editingBlock = useMemo(() => {
    if (!editingBlockId) return null;
    return blocks.find((b) => b.block_id === editingBlockId) || null;
  }, [blocks, editingBlockId]);

  useEffect(() => {
    if (!editingBlock) return;

    setTitle(editingBlock.title || "");
    setFocus(editingBlock.focus || "");
    setAiPrompt(editingBlock.ai_prompt || DEFAULT_AI_PROMPT);
    setRawText(editingBlock.raw_text || "");
    setSelectedWeekNumber(1);
    setSaveError(null);
    setSaveOk(null);
  }, [editingBlock]);

  const visibleWeeks = parsedWeeks.length ? parsedWeeks : editingBlock?.weeks || [];

  const selectedWeek = useMemo(() => {
    return (
      visibleWeeks.find((w) => Number(w.weekNumber) === Number(selectedWeekNumber)) ||
      visibleWeeks[0] ||
      null
    );
  }, [visibleWeeks, selectedWeekNumber]);

  function handleNewBlock() {
    setEditingBlockId("");
    setTitle("");
    setFocus("");
    setAiPrompt(DEFAULT_AI_PROMPT);
    setRawText("");
    setSelectedWeekNumber(1);
    setSaveError(null);
    setSaveOk(null);
  }

  async function handleSave() {
    setSaveError(null);
    setSaveOk(null);

    const safeTitle = title.trim();
    const safeRaw = rawText.trim();

    if (!safeTitle) {
      setSaveError("Add a block title first.");
      return;
    }

    if (!safeRaw) {
      setSaveError("Paste or write the workout block text first.");
      return;
    }

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
          raw_text: safeRaw,
          weeks: parsedWeeks,
          created_by: ownerEmail || null,
        }),
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json?.error || "Failed to save workout block");
      }

      const savedId = String(json?.block_id || editingBlockId || "");

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
            <Link href="/admin">
              Back to admin
            </Link>
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
        <div className="mb-3">
          <Link href="/admin">
            ← Back to admin
          </Link>
        </div>

        <div className="ia-page-title">Workout blocks</div>
        <div className="ia-page-subtitle">
          Create, edit and save 6-week Farm Strong blocks. Use the AI prompt box to generate your next block.
        </div>

        <div className="ia-layout">
          <section className="ia-tile ia-tile-pad ia-editor-panel">
            <div className="ia-editor-head">
              <div>
                <div className="ia-panel-title">{editingBlockId ? "Edit block" : "Create new block"}</div>
                <div className="text-dim">
                  {editingBlockId ? "Changes will update the selected block." : "Save this as a new 6-week block."}
                </div>
              </div>

              <button type="button" className="ia-btn ia-btn-outline" onClick={handleNewBlock}>
                New block
              </button>
            </div>

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

            <label className="ia-label">
              AI prompt
              <textarea
                className="ia-textarea ia-prompt-textarea"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Paste or write the prompt you want to use with AI here."
              />
            </label>

            <div className="ia-editor-actions">
              <button type="button" className="ia-btn ia-btn-outline" onClick={copyPromptToClipboard}>
                Copy AI prompt
              </button>
            </div>

            <label className="ia-label">
              Workout block text
              <textarea
                className="ia-textarea"
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setSelectedWeekNumber(1);
                }}
                placeholder={`WEEK 1 - Foundation Week

Monday - Hinge & Carry

Strength
- Sandbag Over Shoulder x4
- Sandbag Deadlift x8
- Bent Row x8
- Plank x30s

Capacity
- 6 Ground To Shoulder
- 40m Farmer Carry
- 8 Burpees

Athletic
21-15-9
- KB Swings
- Full Body Crunches`}
              />
            </label>

            <div className="ia-parser-row">
              <div className="text-dim">
                Parsed: {parsedWeeks.length} week{parsedWeeks.length === 1 ? "" : "s"}
              </div>

              <button className="ia-btn ia-btn-primary" type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editingBlockId ? "Update block" : "Save block"}
              </button>
            </div>

            {saveError ? <div className="ia-alert ia-alert-error">{saveError}</div> : null}
            {saveOk ? <div className="ia-alert ia-alert-ok">{saveOk}</div> : null}
          </section>

          <section className="ia-tile ia-tile-pad ia-preview-panel">
            <div className="ia-panel-title">Saved blocks</div>

            {isLoading ? <div className="text-dim">Loading blocks…</div> : null}

            {!isLoading && !blocks.length ? (
              <div className="text-dim">No saved workout blocks yet.</div>
            ) : null}

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

            {visibleWeeks.length ? (
              <>
                <div className="ia-week-tabs">
                  {visibleWeeks.map((week) => (
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

                {selectedWeek ? <WeekView week={selectedWeek} /> : null}
              </>
            ) : (
              <div className="ia-empty-preview">
                Select a saved block or start writing a new one.
              </div>
            )}
          </section>
        </div>
      </main>

      <BottomNav />

      <style jsx>{`
        .ia-block-page {
          max-width: 1220px;
        }

        .ia-layout {
          display: grid;
          grid-template-columns: minmax(320px, 460px) minmax(0, 1fr);
          gap: 18px;
          margin-top: 18px;
          align-items: start;
        }

        .ia-editor-panel,
        .ia-preview-panel {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(circle at top left, rgba(245, 130, 32, 0.12), transparent 34%),
            rgba(12, 16, 13, 0.92);
        }

        .ia-editor-head {
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
          min-height: 390px;
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

        .ia-prompt-textarea {
          min-height: 220px;
        }

        .ia-editor-actions {
          display: flex;
          justify-content: flex-end;
          margin: -2px 0 12px;
        }

        .ia-parser-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-top: 14px;
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

        .ia-block-tabs {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 8px;
          margin-bottom: 14px;
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

        .ia-days-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .ia-day-card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          border-radius: 18px;
          padding: 14px;
          min-width: 0;
        }

        .ia-day-head {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 10px;
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

        .ia-block-list {
          padding-left: 18px;
          margin: 0;
          color: rgba(255, 255, 255, 0.86);
          line-height: 1.42;
        }

        .ia-block-list li {
          margin: 4px 0;
        }

        .ia-raw-week,
        .ia-raw-day {
          white-space: pre-wrap;
          background: rgba(0, 0, 0, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 12px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 0.9rem;
          line-height: 1.45;
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

        @media (max-width: 980px) {
          .ia-layout {
            grid-template-columns: 1fr;
          }

          .ia-days-grid {
            grid-template-columns: 1fr;
          }

          .ia-textarea {
            min-height: 320px;
          }

          .ia-prompt-textarea {
            min-height: 200px;
          }
        }
      `}</style>
    </>
  );
}
