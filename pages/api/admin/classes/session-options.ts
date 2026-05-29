// pages/api/admin/classes/session-options.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type GymOption = {
  id: string;
  name: string;
  location?: string | null;
};

type ClassOption = {
  id: string;
  name: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const role = (session?.user as any)?.role || "user";

    if (!session?.user?.email || (role !== "admin" && role !== "gym")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [gymsSnap, classesSnap] = await Promise.all([
      firestore.collection("gyms").get(),
      firestore.collection("gymClasses").get(),
    ]);

    const gyms: GymOption[] = gymsSnap.docs
      .map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          name: String(data?.name || doc.id),
          location: data?.location ? String(data.location) : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const classes: ClassOption[] = classesSnap.docs
      .map((doc) => {
        const data = doc.data() as any;
        const name = String(data?.name || data?.title || doc.id);
        return {
          id: doc.id,
          name,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({ gyms, classes });
  } catch (err: any) {
    console.error("[admin/classes/session-options]", err?.message || err);
    return res.status(500).json({ error: "Failed to load session options" });
  }
}
