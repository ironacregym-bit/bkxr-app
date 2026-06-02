// pages/api/admin/programs/list-simple.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { hasRole } from "../../../lib/rbac";

type ProgramItem = {
  id: string;
  program_id: string;
  name: string;
  weeks: number;
  created_at: string | null;
  created_by: string | null;
  assigned_to_count: number;
};

type Resp =
  | {
      items: ProgramItem[];
    }
  | { error: string };

function toIso(value: any): string | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const snap = await firestore.collection("programs").get();

    const items: ProgramItem[] = snap.docs
      .map((doc) => {
        const data = doc.data() as any;
        const assignedTo = Array.isArray(data?.assigned_to) ? data.assigned_to : [];

        return {
          id: doc.id,
          program_id: String(data?.program_id || doc.id),
          name: String(data?.name || doc.id),
          weeks: Number(data?.weeks || 12),
          created_at: toIso(data?.created_at),
          created_by: data?.created_by ? String(data.created_by) : null,
          assigned_to_count: assignedTo.length,
        };
      })
      .sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) : 0;
        const bTime = b.created_at ? Date.parse(b.created_at) : 0;
        return bTime - aTime;
      });

    return res.status(200).json({ items });
  } catch (err: any) {
    console.error("[admin/programs/list-simple] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load programs" });
  }
}
``
