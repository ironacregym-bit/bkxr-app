
// scripts/hdid/config.ts
export type BookingPrefs = {
  club?: string;              // Optional, if site requires a club selection step
  course?: string;            // Optional, e.g. "Main Course"
  dateYMD: string;            // "2026-02-01"
  teeTime: string;            // "07:30" 24h format
  players: number;            // 1..4
  earliestOpenAt?: string;    // "07:00:00" optional (seconds precision), to ‘arm’ the script before open
};

export function readPrefsFromEnv(): BookingPrefs {
  const dateYMD = process.env.HDID_DATE ?? new Date().toISOString().slice(0,10);
  const teeTime = process.env.HDID_TIME ?? '07:30';
  const players = Number(process.env.HDID_PLAYERS ?? '1');
  const club = process.env.HDID_CLUB || undefined;
  const course = process.env.HDID_COURSE || undefined;
  const earliestOpenAt = process.env.HDID_EARLIEST ?? undefined;
  return { club, course, dateYMD, teeTime, players, earliestOpenAt };
}
