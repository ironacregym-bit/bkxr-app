// pages/api/notifications/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Body = {
  endpoint?: string;
};

type Resp =
  | {
      ok: true;
      email: string;
      endpoint_present: boolean;
      stored_count: number;
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = String(session?.user?.email || "").trim().toLowerCase();

  if (!email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const body = (req.body || {}) as Body;
    const endpoint = String(body?.endpoint || "").trim();

    if (!endpoint) {
      return res.status(400).json({ error: "Endpoint is required" });
    }

    const docRef = firestore.collection("web_push_subscriptions").doc(email);
    const snap = await docRef.get();

    const subs =
      snap.exists && Array.isArray(snap.data()?.subs)
        ? (snap.data()!.subs as any[])
        : [];

    const endpointPresent = subs.some(
      (s: any) => String(s?.endpoint || "") === endpoint
    );

    return res.status(200).json({
      ok: true,
      email,
      endpoint_present: endpointPresent,
      stored_count: subs.length,
    });
  } catch (e: any) {
    console.error("[notifications/status] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to check notification status" });
  }
}
