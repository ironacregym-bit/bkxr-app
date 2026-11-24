
// pages/api/boxing/tech.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Row = { code: string; name?: string; video_url?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Signed-in users can read technique links.
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Optional Firestore collection: boxing_tech (doc id = code)
    const col = firestore.collection("boxing_tech");
    const snap = await col.get();

    const videos: Row[] = snap.docs.map((d) => {
      const x = (d.data() || {}) as any;
      return {
        code: d.id,
        name: typeof x.name === "string" ? x.name : undefined,
        video_url: typeof x.video_url === "string" ? x.video_url : undefined,
      };
    });

    // Returning [] is fine—your chips will just render placeholders.
    return res.status(200).json({ videos });
  } catch (e: any) {
    console.error("[boxing/tech]", e?.message || e);
    // Don’t crash the page; send empty list.
    return res.status(200).json({ videos: [] });
  }
}
