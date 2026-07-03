import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

type GymItem = {
  id: string;
  title: string;
  subtitle: string;
  location: string | null;
};

type Resp = { gyms: GymItem[] } | { error: string; gyms?: GymItem[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed", gyms: [] });
  }

  try {
    const snap = await firestore.collection("gyms").get();

    const gyms = snap.docs
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

        const name = String(data?.name || "Unknown Gym");
        const location = data?.location ? String(data.location) : null;

        return {
          id: doc.id,
          title: name,
          subtitle: location
            ? `${name} • ${location}`
            : "Get class updates, gym sessions and member-focused training through the app.",
          location,
        };
      })
      .filter(Boolean) as GymItem[];

    gyms.sort((a, b) => a.title.localeCompare(b.title));

    return res.status(200).json({ gyms });
  } catch (err: any) {
    console.error("[gyms/list] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load gyms", gyms: [] });
  }
}
