
// /pages/api/admin/members/nutrition.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { hasRole } from "../../../../lib/rbac";

/**
 * Aggregates daily nutrition totals for a user by traversing:
 * nutrition_logs/{email}/{date}/*.docs  (each doc is a code item)
 *
 * Returns items sorted by date desc with:
 * {
 *   id: <date>,
 *   data: {
 *     date: string,
 *     total_protein: number,
 *     total_grams: number,
 *     items_count: number,
 *     per_meal: Record<string, { protein: number; grams: number; items: number }>
 *   }
 * }
 *
 * Pagination: ?limit=50&cursor=<YYYY-MM-DD>
 * - Dates are sorted DESC; cursor is the LAST returned date; next page starts AFTER it.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email) return res.status(400).json({ error: "Missing email" });

  const limit = Math.min(Number(req.query.limit || 50), 100);
  const cursorDate = typeof req.query.cursor === "string" ? req.query.cursor : null;

  try {
    // Root for this user's nutrition tree (DocumentReference)
    const userRoot = firestore.collection("nutrition_logs").doc(email);

    // List first-level subcollections (these are the date collections)
    const dateCollections = await userRoot.listCollections();
    const dateNames = dateCollections
      .map((c) => c.id)
      .filter((id) => /^\d{4}-\d{2}-\d{2}$/.test(id))
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)); // DESC

    // Apply cursor (exclusive)
    let startIndex = 0;
    if (cursorDate) {
      const idx = dateNames.findIndex((d) => d === cursorDate);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    const pageDates = dateNames.slice(startIndex, startIndex + limit);

    const items: { id: string; data: any }[] = [];

    for (const dateId of pageDates) {
      // NOTE: {dateId} is a collection under the user doc
      const dateColRef = userRoot.collection(dateId);

      // Each document inside this collection is a "code" item with fields like:
      // name, protein (number), grams (number), meal (string), etc.
      const snap = await dateColRef.get();

      let totalProtein = 0;
      let totalGrams = 0;
      let itemsCount = 0;

      const perMeal: Record<string, { protein: number; grams: number; items: number }> = {};

      for (const doc of snap.docs) {
        const data = doc.data() || {};
        const protein =
          typeof data.protein === "number" ? data.protein : Number(data.protein) || 0;
        const grams =
          typeof data.grams === "number" ? data.grams : Number(data.grams) || 0;
        const meal = typeof data.meal === "string" ? data.meal : "Other";

        totalProtein += protein;
        totalGrams += grams;
        itemsCount += 1;

        if (!perMeal[meal]) perMeal[meal] = { protein: 0, grams: 0, items: 0 };
        perMeal[meal].protein += protein;
        perMeal[meal].grams += grams;
        perMeal[meal].items += 1;
      }

      items.push({
        id: dateId,
        data: {
          date: dateId,
          total_protein: Number(totalProtein.toFixed(2)),
          total_grams: Number(totalGrams.toFixed(0)),
          items_count: itemsCount,
          per_meal: perMeal,
        },
      });
    }

    const nextCursor =
      pageDates.length === limit ? pageDates[pageDates.length - 1] : null;

    return res.status(200).json({ items, nextCursor });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
