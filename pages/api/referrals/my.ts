// pages/api/referrals/my.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

/**
 * Determines the correct base URL for generating referral links.
 */
function baseUrl() {
  const env =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return env || "";
}

/**
 * GET /api/referrals/my
 * Returns the logged‑in user's referral statistics and list.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Require authentication
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Load user doc
    const userSnap = await firestore.collection("users").doc(email).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    const referralCode: string | undefined = userData.referral_code;

    // If user has no code yet, return empty structure
    if (!referralCode) {
      return res.status(200).json({
        referral_code: "",
        referral_link: "",
        stats: {
          total_signups: 0,
          active_paid: 0,
          commission_rate: 0.05,
          total_earned: 0,
        },
        referrals: [],
      });
    }

    // Fetch referrals where user is referrer
    const referralSnap = await firestore
      .collection("referrals")
      .where("referrer_email", "==", email)
      .get();

    const rows = referralSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() || {}),
    }));

    // Stats
    const total_signups = rows.length;
    const active_paid = rows.filter((r: any) => r?.converted_to_paid === true).length;

    const commission_rate =
      Number(userData?.referral_totals?.commission_rate ?? 0.05);

    const total_earned = Number(
      userData?.referral_totals?.total_earned ?? 0
    );

    // Shape list for frontend
    const referrals = rows.map((r: any) => ({
      email: r.referred_email || "",
      status: r.subscription_status || "trialing",
      converted_to_paid: Boolean(r.converted_to_paid),
      first_payment_month:
        Array.isArray(r.commission_entries) && r.commission_entries.length > 0
          ? r.commission_entries[0].month
          : null,
      total_commission_from_user: Array.isArray(r.commission_entries)
        ? r.commission_entries.reduce(
            (sum: number, e: any) => sum + Number(e.amount || 0),
            0
          )
        : 0,
    }));

    return res.status(200).json({
      referral_code: referralCode,
      referral_link: `${baseUrl()}/register?ref=${encodeURIComponent(
        referralCode
      )}`,
      stats: {
        total_signups,
        active_paid,
        commission_rate,
        total_earned,
      },
      referrals,
    });
  } catch (err: any) {
    console.error("[referrals/my] error:", err?.message || err);
    return res.status(500).json({
      error: "Failed to load referrals",
      detail: err?.message || "Unknown error",
    });
  }
}
