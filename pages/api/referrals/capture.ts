
// pages/api/referrals/capture.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { FieldValue } from "@google-cloud/firestore";

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const referredEmail = session?.user?.email;
  if (!referredEmail) return res.status(401).json({ error: "Unauthorized" });

  const { referral_code } = (req.body || {}) as { referral_code?: string };
  if (!referral_code || typeof referral_code !== "string") {
    return res.status(400).json({ error: "referral_code required" });
  }

  try {
    const usersCol = firestore.collection("users");

    const referrerSnap = await usersCol.where("referral_code", "==", referral_code).limit(1).get();
    if (referrerSnap.empty) {
      return res.status(404).json({ error: "Invalid referral code" });
    }

    const referrerDoc = referrerSnap.docs[0];
    const referrerEmail = referrerDoc.id;

    if (referrerEmail === referredEmail) {
      return res.status(200).json({ ok: true, note: "Self-referral ignored" });
    }

    const existingSnap = await firestore
      .collection("referrals")
      .where("referred_email", "==", referredEmail)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return res.status(200).json({ ok: true, note: "Referral already captured" });
    }

    const referredUserSnap = await usersCol.doc(referredEmail).get();
    const referredUserData = referredUserSnap.exists ? referredUserSnap.data() || {} : {};
    const subStatus = String(referredUserData.subscription_status || "trialing");

    const payload = {
      referral_code,
      referrer_email: referrerEmail,
      referred_email: referredEmail,
      created_at: new Date().toISOString(),
      subscription_status: subStatus,
      converted_to_paid: false,
      current_commission_rate: Number(referrerDoc.data()?.referral_totals?.commission_rate ?? 0.05),
      commission_total_earned: 0,
      commission_entries: [] as Array<any>,
      last_updated_month: monthKey(),
    };

    const refDoc = await firestore.collection("referrals").add(payload);

    await usersCol.doc(referrerEmail).set(
      {
        referral_totals: {
          total_signups: FieldValue.increment(1),
        },
      },
      { merge: true }
    );

    await usersCol.doc(referredEmail).set(
      {
        referred_by_code: referral_code,
        referred_by_email: referrerEmail,
        referred_at: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, id: refDoc.id });
  } catch (e: any) {
    console.error("[referrals/capture] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to capture referral" });
  }
}
