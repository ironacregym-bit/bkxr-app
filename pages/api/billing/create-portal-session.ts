
// pages/api/billing/create-portal-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { stripe } from "../../../lib/stripe";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthenticated" });

    const userRef = firestore.collection("users").doc(email);
    const snap = await userRef.get();
    const stripeCustomerId = (snap.data()?.stripe_customer_id as string) || undefined;
    if (!stripeCustomerId) return res.status(400).json({ error: "No Stripe customer id on file" });

    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/billing`,
    });

    return res.status(200).json({ url: portal.url });
  } catch (e: any) {
    console.error("[create-portal-session] error:", e);
    return res    return res.status(500).json({ error: e?.message || "Failed to create portal session" });
  }
}
