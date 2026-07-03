import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]";
import { hasRole } from "../../../../../lib/rbac";
import { assignProgramToMember } from "../../../../../lib/programAssignments";

type Body = {
  user_email?: string;
  gym_id?: string;
  program_id?: string;
  start_date?: string;
  note?: string | null;
};

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = (req.body || {}) as Body;

    const userEmail = String(body.user_email || "").trim().toLowerCase();
    const gymId = String(body.gym_id || "").trim();
    const programId = String(body.program_id || "").trim();
    const startDate = String(body.start_date || "").trim();
    const note = body.note != null ? String(body.note) : null;
    const createdBy = String((session.user as any)?.email || "").trim().toLowerCase() || null;

    if (!isEmail(userEmail)) {
      return res.status(400).json({ error: "Invalid user_email" });
    }

    if (!gymId) {
      return res.status(400).json({ error: "gym_id is required" });
    }

    if (!programId) {
      return res.status(400).json({ error: "program_id is required" });
    }

    if (!startDate) {
      return res.status(400).json({ error: "start_date is required" });
    }

    const result = await assignProgramToMember({
      userEmail,
      gymId,
      programId,
      startDate,
      note,
      createdBy,
      sendNotification: true,
      skipIfAlreadyActive: false,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    console.error("[admin/members/programs/assign] error:", err?.message || err);
    return res.status(500).json({
      error: err?.message || "Failed to assign program",
    });
  }
}
