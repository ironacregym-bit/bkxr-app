import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions).catch(() => null);
  const role = (session?.user as any)?.role;

  if (!session || !["admin", "gym"].includes(role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const snap = await firestore
      .collection("programs")
      .orderBy("created_at", "desc")
      .get();

    const programs = snap.docs.map((d) => ({
      program_id: d.id,
      name: d.get("name"),
      start_date: d.get("start_date")?.toDate?.() ?? null,
      weeks: d.get("weeks"),
    }));

    res.status(200).json({ programs });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load programs" });
  }
}
