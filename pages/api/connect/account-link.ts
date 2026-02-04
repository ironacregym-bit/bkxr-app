// pages/api/connect/account-link.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { stripe } from "../../../lib/stripe";
import firestore from "../../../lib/firestoreClient";

function origin() {
  return process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
}

/**
 * Returns a Stripe Account Link URL to continue onboarding or update details.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const userSnap = await firestore.collection("users").doc(email).get();
    const accountId = (userSnap.data()?.stripe_connect_id as string) || "";
    if (!accountId) return res.status(400).json({ error: "No connected account. Create one first." });

    const base = origin();
    if (!base) return res.status(500).json({ error: "Missing NEXTAUTH_URL/VERCEL_URL" });

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/referrals?onboarding=refresh`,
      return_url: `${base}/referrals?onboarding=return`,
      type: "account_onboarding",
    });

    return res.status(200).json({ url: link.url });
  } catch (e: any) {
    console.error("[connect/account-link]", e?.message || e);
    return res.status(500).json({ error: "Failed to create account link" });
  }
}
