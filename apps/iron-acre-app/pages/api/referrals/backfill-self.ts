
// pages/api/referrals/backfill-self.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { randomBytes } from "crypto";
import { FieldValue } from "@google-cloud/firestore";

function shortCode(len = 6) {
  return randomBytes(6).toString("base64url").slice(0, len);
}

async function generateUniqueReferralCode() {
  for (let i = 0; i < 5; i++) {
    const code = shortCode(6 + i);
    const snap = await firestore
      .collection("users")
      .where("referral_code", "==", code)
      .limit(1)
      .get();
    if (snap.empty) return code;
  }
  return shortCode(8);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const userRef = firestore.collection("users").doc(email);
  const snap = await userRef.get();
  const data = snap.data() || {};

  if (data.referral_code) {
    return res.status(200).json({ ok: true, alreadyHadCode: true });
  }

  const newCode = await generateUniqueReferralCode();

  await userRef.set(
    {
      referral_code: newCode,
      referral_totals: {
        total_signups: FieldValue.increment(0),
        active_paid: FieldValue.increment(0),
        commission_rate: 0.05,
        total_earned: 0,
      },
    },
    { merge: true }
  );

  return res.status(200).json({
    ok: true,
    referral_code: newCode,
  });
}
