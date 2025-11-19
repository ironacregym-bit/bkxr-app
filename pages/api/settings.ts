import type { NextApiRequest, NextApiResponse } from "next";
import { readRange } from "../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rows = await readRange("Settings!A:B"); // Key | Value
  const map: Record<string, string> = {};
  (rows || []).slice(1).forEach(r => { if (r[0]) map[r[0]] = r[1]; });
  res.json({
    rounds: Number(map.rounds ?? 10),
    boxing_rounds: Number(map.boxing_rounds ?? 5),
    bell_rounds: Number(map.bell_rounds ?? 5),
    work_sec: Number(map.work_sec ?? 180),
    rest_sec: Number(map.rest_sec ?? 60),
    default_MET_boxing: Number(map.default_MET_boxing ?? 7.8),
    default_MET_kb: Number(map.default_MET_kb ?? 9.8)
  });
}
