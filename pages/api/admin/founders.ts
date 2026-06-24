// pages/api/admin/founders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

type Item = {
  id: string;
  source?: string;
  name: string;
  email: string;
  phone?: string | null;
  interested_classes: string[];
  preferred_times: string[];
  sessions_per_week: string;
  biggest_goal: string;
  referral_name?: string | null;
  referral_contact?: string | null;
  consent_to_contact: boolean;
  created_at?: string | null;
};

type Resp = {
  items: Item[];
};

function toISO(v: any): string | null {
  try {
    if (!v) return null;

    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
    }

    const d = new Date(v);
    return !isNaN(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ error: "Not signed in" });
    }

    if (!hasRole(session, ["admin", "gym"])) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const snap = await firestore
      .collection("founders_interest")
      .orderBy("created_at", "desc")
      .get();

    const items: Item[] = snap.docs.map((doc) => {
      const d = doc.data() as any;

      return {
        id: doc.id,
        source: typeof d?.source === "string" ? d.source : undefined,
        name: typeof d?.name === "string" ? d.name : "",
        email: typeof d?.email === "string" ? d.email : "",
        phone: typeof d?.phone === "string" ? d.phone : null,
        interested_classes: Array.isArray(d?.interested_classes)
          ? d.interested_classes.map((x: any) => String(x || "")).filter(Boolean)
          : [],
        preferred_times: Array.isArray(d?.preferred_times)
          ? d.preferred_times.map((x: any) => String(x || "")).filter(Boolean)
          : [],
        sessions_per_week:
          typeof d?.sessions_per_week === "string" ? d.sessions_per_week : "",
        biggest_goal: typeof d?.biggest_goal === "string" ? d.biggest_goal : "",
        referral_name:
          typeof d?.referral_name === "string" ? d.referral_name : null,
        referral_contact:
          typeof d?.referral_contact === "string" ? d.referral_contact : null,
        consent_to_contact: d?.consent_to_contact === true,
        created_at: toISO(d?.created_at),
      };
    });

    return res.status(200).json({ items });
  } catch (err: any) {
    console.error("[admin/founders] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load founders submissions" });
  }
}
