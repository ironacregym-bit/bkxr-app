
// pages/api/workouts/admin/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb as db } from "../../../../lib/firebaseAdmin";

/**
 * Hardened admin workout fetch:
 *  - Loads workout doc + rounds + items
 *  - Normalises Superset inner array: `superset_items` -> `items`
 *  - Tolerates missing `order` by sorting in-memory
 *  - Emits structured error info { where, details } on 500s for faster debugging
 */

// Ensure Node runtime (avoid edge pitfalls)
export const config = { api: { bodyParser: false } };

type ApiError = { error: string; where?: string; details?: string };

// Small helper to emit uniform errors with "where"
function fail(res: NextApiResponse<ApiError>, whereStr: string, e?: any) {
  const msg = (e && (e.message || String(e))) || "Unknown error";
  // Log on server
  console.error(`[workouts/admin/[id]] ${whereStr}:`, msg);
  return res.status(500).json({ error: "Failed to load workout for admin", where: whereStr, details: msg });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<any | ApiError>) {
  try {
    const idParam = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const workout_id = (idParam || "").trim();
    if (!workout_id) return res.status(400).json({ error: "id is required" });

    // 1) Load workout doc (defensive)
    let doc;
    try {
      doc = await db.collection("workouts").doc(workout_id).get();
    } catch (e) {
      return fail(res, "get(workout)", e);
    }
    if (!doc.exists) return res.status(404).json({ error: "Workout not found" });

    const base = doc.data() || {};

    // 2) Load rounds. Prefer ordered; if it fails (no index / missing field), fallback unordered.
    let roundsSnap;
    try {
      roundsSnap = await db.collection("workouts").doc(workout_id).collection("rounds").orderBy("order", "asc").get();
    } catch (e) {
      console.warn("[workouts/admin/[id]] orderBy(order) on rounds failed; retrying without orderBy");
      try {
        roundsSnap = await db.collection("workouts").doc(workout_id).collection("rounds").get();
      } catch (ee) {
        return fail(res, "get(rounds)", ee);
      }
    }

    // 3) Map each round + items with strong guards
    const rounds: any[] = [];
    for (const rDoc of roundsSnap.docs) {
      const rData = rDoc.data() || {};

      // Load items within the round
      let itemsSnap;
      try {
        try {
          itemsSnap = await db
            .collection("workouts").doc(workout_id)
            .collection("rounds").doc(rDoc.id)
            .collection("items")
            .orderBy("order", "asc")
            .get();
        } catch {
          itemsSnap = await db
            .collection("workouts").doc(workout_id)
            .collection("rounds").doc(rDoc.id)
            .collection("items")
            .get();
        }
      } catch (e) {
        return fail(res, `get(items) for round ${rDoc.id}`, e);
      }

      const items = itemsSnap.docs.map((iDoc) => {
        const d = iDoc.data() || {};
        const out: any = { item_id: iDoc.id, ...d };

        // Normalise Superset inner exercises:
        // If the item is a Superset and `items` is not present, but `superset_items` exists,
        // copy it into `items` so the UI can render consistently.
        const isSuperset =
          (d.type && String(d.type).toLowerCase() === "superset") ||
          d.is_superset === true;

        if (isSuperset) {
          if (!Array.isArray(out.items) && Array.isArray(d.superset_items)) {
            out.items = d.superset_items;
          }
          // (Optionally support older keys)
          // else if (!Array.isArray(out.items) && Array.isArray(d.collection)) {
          //   out.items = d.collection;
          // }

          if (!Array.isArray(out.items)) out.items = [];
        }

        return out;
      });

      // Sort items in-memory if no valid `order`
      items.sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));

      rounds.push({
        round_id: rDoc.id,
        ...rData,
        items,
      });
    }

    // Sort rounds in-memory if needed
    rounds.sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));

    // 4) Normalise to warmup/main/finisher by name (case/space-insensitive)
    const key = (s: any) => String(s || "").toLowerCase().replace(/\s+/g, "");
    const byName = (n: string) => rounds.find((r) => key(r.name) === key(n)) || null;

    const warmup   = byName("Warm Up") || byName("Warmup");
    const main     = byName("Main Set") || byName("Main") || rounds.find((r) => (r?.order ?? 0) === 2) || null;
    const finisher = byName("Finisher");

    return res.status(200).json({
      workout_id: doc.id,
      ...base,
      warmup,
      main,
      finisher,
      _rounds: rounds, // keep raw rounds visible for admin inspection
    });
  } catch (err: any) {
    return fail(res, "unhandled", err);
  }
}
