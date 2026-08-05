// File: pages/admin/workouts/blocks.tsx

import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
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
  const match = cleaned.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b\s*[-:–]?\s*(.*)$/i);
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

  weekStartIndexes.forEach((weekStart, i) => {
    const next = weekStartIndexes[i + 1];
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

  dayStartIndexes.forEach((dayStart, i) => {
    const next = dayStartIndexes[i + 1];
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

function normaliseBlocks(raw: any): WorkoutBlock[] {
  const arr =
    (Array.isArray(raw?.blocks) && raw.blocks) ||
    (Array.isArray(raw?.items) && raw.items) ||
    (Array.isArray(raw?.data) && raw.data) ||
    [];

  return arr
    .map((x: any) => ({
      block_id: String(x?.block_id || x?.id || "").trim(),
      title: String(x?.title || x?.name || "Untitled block").trim(),
      focus: x?.focus ?? null,
      raw_text: String(x?.raw_text || ""),
      weeks: Array.isArray(x?.weeks) ? x.weeks : [],
      created_by: x?.created_by ?? null,
      created_at: x?.created_at ?? null,
      updated_at: x?.updated_at ?? null,
    }))
    .filter((x: WorkoutBlock) => x.block_id);
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

  const { data, mutate, isLoading } = useSWR<BlocksResponse>("/api/workout-blocks?limit=20", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const blocks = useMemo(() => normaliseBlocks(data), [data]);

  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [rawText, setRawText] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const parsedWeeks = useMemo(() => parseWorkoutText(rawText), [rawText]);

  const selectedBlock = useMemo(() => {
    if (selectedBlockId) {
      const found = blocks.find((b) => b.block_id === selectedBlockId);
      if (found) return found;
    }
    return blocks[0] || null;
  }, [blocks, selectedBlockId]);

  const visibleWeeks = selectedBlock?.weeks?.length ? selectedBlock.weeks : parsedWeeks;

  const selectedWeek = useMemo(() => {
    return (
      visibleWeeks.find((w) => Number(w.weekNumber) === Number(selectedWeekNumber)) ||
      visibleWeeks[0] ||
      null
    );
  }, [visibleWeeks, selectedWeekNumber]);

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
      setSaveError("Paste the workout block text first.");
      return;
    }

    setSaving(true);

    try {
      const resp = await fetch("/api/workout-blocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: safeTitle,
          focus: focus.trim() || null,
          raw_text: safeRaw,
          weeks: parsedWeeks,
          created_by: ownerEmail || null,
        }),
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json?.error || "Failed to save workout block");
      }

      setSaveOk("Workout block saved.");
      setTitle("");
      setFocus("");
      setRawText("");
      setSelectedBlockId(json.block_id || "");
      setSelectedWeekNumber(1);
      await mutate();
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save workout block");
    } finally {
      setSaving(false);
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
          Build, paste and save 6-week Farm Strong blocks. Open each block and click through the weeks like tabs.
        </div>

        <div className="ia-layout">
          <section className="ia-tile ia-tile-pad ia-create-panel">
            <div className="ia-panel-title">Create new 6-week block</div>

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
              Paste block text
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
                {saving ? "Saving…" : "Save block"}
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
                  const active = (selectedBlock?.block_id || "") === block.block_id;
                  return (
                    <button
                      key={block.block_id}
                      type="button"
                      className={`ia-block-tab ${active ? "active" : ""}`}
                      onClick={() => {
                        setSelectedBlockId(block.block_id);
                        setSelectedWeekNumber(1);
                      }}
                    >
                      <span>{block.title}</span>
                      {block.focus ? <small>{block.focus}</small> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {!blocks.length && parsedWeeks.length ? (
              <div className="ia-preview-note">
                Previewing unsaved text. Save it to make it available as a block tab.
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
                Paste a block on the left or choose a saved block above.
              </div>
            )}
          </section>
        </div>
      </main>

      <BottomNav />

      <style jsx>{`
        .ia-block-page {
          max-width: 1180px;
        }

        .ia-layout {
          display: grid;
          grid-template-columns: minmax(320px, 440px) minmax(0, 1fr);
          gap: 18px;
          margin-top: 18px;
          align-items: start;
        }

        .ia-create-panel,
        .ia-preview-panel {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(circle at top left, rgba(245, 130, 32, 0.12), transparent 34%),
            rgba(12, 16, 13, 0.92);
        }

        .ia-panel-title {
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 14px;
        }

        .ia-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 700;
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
          min-height: 430px;
          resize: vertical;
          line-height: 1.45;
          font-family:
            ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
            monospace;
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
          font-weight: 700;
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

        .ia-preview-note {
          border: 1px dashed rgba(245, 130, 32, 0.45);
          background: rgba(245, 130, 32, 0.08);
          border-radius: 14px;
          padding: 10px 12px;
          margin-bottom: 12px;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.9rem;
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
        }
      `}</style>
    </>
  );
}
