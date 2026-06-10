// pages/api/iron-acre/members/link-pending.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import { adminDb as db } from "../../../../lib/firebaseAdmin";

function resolveUserKey(session: any) {
  const user = session?.user as any;
  return String(user?.id || user?.uid || user?.email || "").trim();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true; linked: boolean; memberId?: string } | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const email = String(session.user.email || "").trim().toLowerCase();
    const userKey = resolveUserKey(session);

    if (!email) {
      return res.status(400).json({ error: "Unable to resolve user email" });
    }

    const snap = await db
      .collection("ironAcreMembers")
      .where("email_normalized", "==", email)
      .limit(10)
      .get();

    if (snap.empty) {
      return res.status(200).json({
        ok: true,
        linked: false,
      });
    }

    const docs = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .sort((a: any, b: any) => {
        const at = a?.createdAt?.toMillis?.() || 0;
        const bt = b?.createdAt?.toMillis?.() || 0;
        return bt - at;
      });

    const candidate = docs.find((doc: any) => !doc.auth_uid) || docs[0];
    if (!candidate?.id) {
      return res.status(200).json({ ok: true, linked: false });
    }

    await db.collection("ironAcreMembers").doc(candidate.id).set(
      {
        auth_uid: userKey || null,
        linkedUserId: userKey || null,
        linkStatus: "linked",
        linkedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      linked: true,
      memberId: candidate.id,
    });
  } catch (err: any) {
    console.error("[iron-acre/members/link-pending]", err?.message || err);
    return res.status(500).json({ error: "Failed to link member record" });
  }
}
