import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient"; // ✅ your Firestore client

type ApiError = { error: string; where?: string; details?: string };

function fail(res: NextApiResponse<ApiError>, whereStr: string, e?: any) {
  console.error("[WORKOUT API ERROR]", {
    where: whereStr,
    message: e?.message,
    stack: e?.stack,
  });

  return res.status(500).json({
    error: "Failed to load workout",
    where: whereStr,
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any | ApiError>
) {
  try {
    const idParam = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const workout_id = String(idParam || "").trim();

    if (!workout_id) {
      return res.status(400).json({ error: "id is required" });
    }

    // ✅ WORKOUT DOC
    let doc;
    try {
      doc = await db.collection("workouts").doc(workout_id).get();
    } catch (e) {
      return fail(res, "get(workout)", e);
    }

    if (!doc.exists) {
      return res.status(404).json({ error: "Workout not found" });
    }

    const base = doc.data() || {};

    // ✅ ROUNDS (safe orderBy fallback)
    let roundsSnap;
    try {
      roundsSnap = await db
        .collection("workouts")
        .doc(workout_id)
        .collection("rounds")
        .orderBy("order", "asc")
        .get();
    } catch (e) {
      console.warn("[rounds orderBy failed, fallback]", e);

      try {
        roundsSnap = await db
          .collection("workouts")
          .doc(workout_id)
          .collection("rounds")
          .get();
      } catch (ee) {
        return fail(res, "get(rounds)", ee);
      }
    }

    const rounds: any[] = [];

    for (const rDoc of roundsSnap.docs) {
      const rData = rDoc.data() || {};

      let itemsSnap;

      // ✅ ITEMS SAFE FETCH (DO NOT CRASH REQUEST)
      try {
        try {
          itemsSnap = await db
            .collection("workouts")
            .doc(workout_id)
            .collection("rounds")
            .doc(rDoc.id)
            .collection("items")
            .orderBy("order", "asc")
            .get();
        } catch (e) {
          console.warn(`[items orderBy failed] round ${rDoc.id}`, e);

          try {
            itemsSnap = await db
              .collection("workouts")
              .doc(workout_id)
              .collection("rounds")
              .doc(rDoc.id)
              .collection("items")
              .get();
          } catch (ee) {
            console.error(`[items fallback failed] round ${rDoc.id}`, ee);

            // ✅ DO NOT FAIL — just empty items
            itemsSnap = { docs: [] } as any;
          }
        }
      } catch (e) {
        console.error(`[items hard fail] round ${rDoc.id}`, e);
        itemsSnap = { docs: [] } as any;
      }

      // ✅ SAFE MAP
      const items = (itemsSnap.docs || []).map((iDoc: any) => {
        const d = iDoc.data() || {};
        const out: any = { item_id: iDoc.id, ...(d || {}) };

        const isSuperset =
          (d.type && String(d.type).toLowerCase() === "superset") ||
          d.is_superset === true;

        if (isSuperset) {
          if (!Array.isArray(out.items) && Array.isArray((d as any).superset_items)) {
            out.items = (d as any).superset_items;
          }

          if (!Array.isArray(out.items)) out.items = [];

          out.items = out.items.map((s: any) => ({
            exercise_id: s?.exercise_id ?? "",
            reps: s?.reps ?? null,
            weight_kg: s?.weight_kg ?? null,
            strength: s?.strength ?? null,
            exercise_name: s?.exercise_name ?? null,
          }));
        }

        if (String(d.type || "").toLowerCase() === "single") {
          out.strength = d?.strength ?? null;
        }

        return out;
      });

      // ✅ SAFE SORT
      items.sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));

      rounds.push({
        round_id: rDoc.id,
        ...(rData || {}),
        items,
      });
    }

    // ✅ SAFE ROUND SORT
    rounds.sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));

    // ✅ STRUCTURE NORMALISATION
    const key = (s: any) => String(s || "").toLowerCase().replace(/\s+/g, "");
    const byName = (n: string) =>
      rounds.find((r) => key(r.name) === key(n)) || null;

    const warmup = byName("Warm Up") || byName("Warmup") || null;

    const main =
      byName("Main Set") ||
      byName("Main") ||
      rounds.find((r) => (r?.order ?? 0) === 2) ||
      null;

    const finisher = byName("Finisher") || null;

    return res.status(200).json({
      workout_id: doc.id,
      ...base,
      warmup,
      main,
      finisher,
      _rounds: Array.isArray(rounds) ? rounds : [],
    });
  } catch (err: any) {
    return fail(res, "unhandled", err);
  }
}
