// pages/api/workouts/admin/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";

/**
 * Admin workout fetch (client SDK)
 * - Loads workout doc + rounds + items
 * - Normalises Superset inner array: `superset_items` -> `items`
 * - Preserves strength blocks:
 *    - Single.strength
 *    - Superset.items[].strength
 * - Tolerates missing `order` by sorting in-memory
 */

export const config = { api: { bodyParser: false } };

type ApiError = { error: string; where?: string; details?: string };

function fail(res: NextApiResponse<ApiError>, whereStr: string, e?: any) {
  const msg = (e && (e.message || String(e))) || "Unknown error";
  console.error(`[workouts/admin/[id]] ${whereStr}:`, msg);
  return res.status(500).json({
    error: "Failed to load workout for admin",
    where: whereStr,
    details: msg,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<any | ApiError>) {
  try {
    const idParam = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const workout_id = (idParam || "").trim();
    if (!workout_id) return res.status(400).json({ error: "id is required" });

    // 1) Load workout doc
    let doc;
    try {
      doc = await firestore.collection("workouts").doc(workout_id).get();
    } catch (e) {
      return fail(res, "get(workout)", e);
    }

    if (!doc.exists) return res.status(404).json({ error: "Workout not found" });

    const base = doc.data() || {};

    // 2) Load rounds (ordered if possible)
    let roundsSnap;
    try {
      roundsSnap = await firestore
        .collection("workouts")
        .doc(workout_id)
        .collection("rounds")
        .orderBy("order", "asc")
        .get();
    } catch {
      roundsSnap = await firestore
        .collection("workouts")
        .doc(workout_id)
        .collection("rounds")
        .get();
    }

    const rounds: any[] = [];

    for (const rDoc of roundsSnap.docs) {
      const rData = rDoc.data() || {};

      // 3) Load items for round
      let itemsSnap;
      try {
        try {
          itemsSnap = await firestore
            .collection("workouts")
            .doc(workout_id)
            .collection("rounds")
            .doc(rDoc.id)
            .collection("items")
            .orderBy("order", "asc")
            .get();
        } catch {
          itemsSnap = await firestore
            .collection("workouts")
            .doc(workout_id)
            .collection("rounds")
            .doc(rDoc.id)
            .collection("items")
            .get();
        }
      } catch (e) {
        return fail(res, `get(items) for round ${rDoc.id}`, e);
      }

      const items = itemsSnap.docs.map((iDoc) => {
        const d = iDoc.data() || {};
        const out: any = { item_id: iDoc.id, ...d };

        const isSuperset =
          String(d.type || "").toLowerCase() === "superset" || d.is_superset === true;

        if (isSuperset) {
          const subs = Array.isArray(d.items)
            ? d.items
            : Array.isArray(d.superset_items)
            ? d.superset_items
            : [];

          out.items = subs.map((s: any) => ({
            exercise_id: s?.exercise_id ?? "",
            reps: s?.reps ?? null,
            weight_kg: s?.weight_kg ?? null,
            strength: s?.strength ?? null,
          }));
        }

        if (String(d.type || "").toLowerCase() === "single") {
          out.strength = d?.strength ?? null;
        }

        return out;
      });

      items.sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));

      rounds.push({
        round_id: rDoc.id,
        ...rData,
        items,
      });
    }

    rounds.sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));

    // 4) Normalise to warmup / main / finisher by name
    const key = (s: any) => String(s || "").toLowerCase().replace(/\s+/g, "");
    const byName = (n: string) => rounds.find((r) => key(r.name) === key(n)) || null;

    const warmup = byName("Warm Up") || byName("Warmup");
    const main =
      byName("Main Set") ||
      byName("Main") ||
      rounds.find((r) => (r?.order ?? 0) === 2) ||
      null;
    const finisher = byName("Finisher");

    return res.status(200).json({
      workout_id: doc.id,
      ...base,
      warmup,
      main,
      finisher,
      _rounds: rounds,
    });
  } catch (err: any) {
    return fail(res, "unhandled", err);
  }
}
