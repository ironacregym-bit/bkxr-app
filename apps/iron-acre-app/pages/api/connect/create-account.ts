// pages/api/connect/create-account.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { stripe } from "../../../lib/stripe";
import firestore from "../../../lib/firestoreClient";

/**
 * Creates (or returns) a Stripe Connect Express account for the current user,
 * stores users/{email}.stripe_connect_id, and returns the account id.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const userRef = firestore.collection("users").doc(email);
    const snap = await userRef.get();
    const data = snap.exists ? (snap.data() || {}) : {};
    let acctId: string | undefined = data.stripe_connect_id;

    if (!acctId) {
      const account = await stripe.accounts.create({
        type: "express",
        email,
        country: "GB", // set to your referrers' default country (GB for the UK)
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
      });
      acctId = account.id;
      await userRef.set({ stripe_connect_id: acctId }, { merge: true });
    }

    return res.status(200).json({ account_id: acctId });
  } catch (e: any) {
    console.error("[connect/create-account]", e?.message || e);
    return res.status(500).json({ error: "Failed to create connect account" });
  }
}
