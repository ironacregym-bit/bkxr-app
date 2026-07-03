import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

type ProgramItem = {
  id: string;
  program_id: string;
  title: string;
  subtitle: string;
  weeks: number | null;
};

type Resp = { items: ProgramItem[] } | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const snap = await firestore.collection("programs").get();

    const items = snap.docs
      .map((doc) => {
        const data = doc.data() as any;

        const isArchived =
          data?.archived === true ||
          data?.is_archived === true ||
          data?.status === "archived";

        const isInactive =
          data?.active === false ||
          data?.is_active === false ||
          data?.status === "inactive";

        if (isArchived || isInactive) return null;

        return {
          id: doc.id,
          program_id: String(data?.program_id || doc.id),
          title: String(data?.name || data?.title || doc.id),
          subtitle: String(
            data?.subtitle ||
              data?.description ||
              `${Number(data?.weeks || 12)} week training programme`
          ),
          weeks: Number.isFinite(Number(data?.weeks)) ? Number(data.weeks) : null,
        };
      })
      .filter(Boolean) as ProgramItem[];

    items.sort((a, b) => a.title.localeCompare(b.title));

    return res.status(200).json({ items });
  } catch (err: any) {
    console.error("[programs/list] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load programs" });
  }
}
