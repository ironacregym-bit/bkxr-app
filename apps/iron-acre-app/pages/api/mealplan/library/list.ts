import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type PlanSummary = {
  id: string;
  title: string;
  tier: "free" | "premium";
  description?: string | null;
  image?: string | null;
  locked?: boolean; // premium but user not subscribed
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || "";
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const userSnap = await firestore.collection("users").doc(email).get();
    const user = userSnap.exists ? (userSnap.data() as any) : {};
    const subscription = String(user.subscription_status || "").toLowerCase(); // "active"|"trialing"|...
    const isPremium = subscription === "active" || subscription === "trialing";

    const tierFilter = String(req.query.tier || "").trim().toLowerCase(); // optional: free|premium
    let ref: FirebaseFirestore.Query = firestore.collection("meal_plan_library").orderBy("title");
    if (tierFilter && (tierFilter === "free" || tierFilter === "premium")) {
      ref = ref.where("tier", "==", tierFilter);
    }

    const snap = await ref.limit(200).get();
    const plans: PlanSummary[] = snap.docs.map((d) => {
      const x = d.data() as any;
      const tier = (x.tier || "free").toLowerCase();
      return {
        id: d.id,
        title: String(x.title || "Meal Plan"),
        tier: tier === "premium" ? "premium" : "free",
        description: x.description || null,
        image: x.image || null,
        locked: tier === "premium" ? !isPremium : false,
      };
    });

    return res.status(200).json({ plans, isPremium });
  } catch (e: any) {
    console.error("[mealplan/library/list]", e?.message || e);
    return res.status(500).json({ error: "Failed to list meal plans" });
  }
}
