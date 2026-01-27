
// /pages/api/workouts/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

type SingleItemOut = {
  type: "Single";
  order: number;
  exercise_id: string;
  exercise_name?: string;
  sets?: number | null;
  reps?: string | null;
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

type SupersetSubOut = {
  exercise_id: string;
  exercise_name?: string;
  reps?: string | null;
  weight_kg?: number | null;
};

type SupersetItemOut = {
  type: "Superset";
  order: number;
  name?: string | null;
  items: SupersetSubOut[];
  sets?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

type GymRoundOut = {
  name: string;
  order: number;
  items: Array<SingleItemOut | SupersetItemOut>;
};

type GymWorkoutOut = {
  workout_id: string;
  workout_name: string;
  focus?: string | null;
  notes?: string | null;
  video_url?: string | null;
  warmup?: GymRoundOut | null;
  main: GymRoundOut;
  finisher?: GymRoundOut | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const WORKOUTS_COLLECTION = "workouts";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GymWorkoutOut | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: "Not signed in" });
    if (!hasRole(session, ["user", "gym", "admin"])) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { id } = req.query;
    const workoutId = Array.isArray(id) ? id[0] : id;
    if (!workoutId) return res.status(400).json({ error: "Missing workout id" });

    const db = firestore;

    // 1) Try doc by id
    let docRef = db.collection(WORKOUTS_COLLECTION).doc(workoutId);
    let docSnap = await docRef.get();

    // 2) If not found, try where workout_id == id
    if (!docSnap.exists) {
      const q = await db
        .collection(WORKOUTS_COLLECTION)
        .where("workout_id", "==", workoutId)
        .limit(1)
        .get();
      if (!q.empty) {
        docSnap = q.docs[0];
        docRef = docSnap.ref;
      }
    }

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Workout not found" });
    }

    const w = docSnap.data() || {};
    const rootId = String(w.workout_id || docSnap.id);

    // Load rounds
    const roundsSnap = await docRef.collection("rounds").orderBy("order", "asc").get();

    // Helper to load items for a round doc
    async function loadItems(roundDoc: FirebaseFirestore.QueryDocumentSnapshot): Promise<Array<SingleItemOut | SupersetItemOut>> {
      const itemsSnap = await roundDoc.ref.collection("items").orderBy("order", "asc").get();
      const items: Array<SingleItemOut | SupersetItemOut> = [];
      itemsSnap.forEach((itemDoc) => {
        const d = itemDoc.data() || {};
        if (d.type === "Single") {
          items.push({
            type: "Single",
            order: Number(d.order ?? 0),
            exercise_id: String(d.exercise_id || ""),
            exercise_name: typeof d.exercise_name === "string" ? d.exercise_name : undefined,
            sets: d.sets ?? null,
            reps: d.reps ?? null,
            weight_kg: d.weight_kg ?? null,
            rest_s: d.rest_s ?? null,
            notes: d.notes ?? null,
          });
        } else if (d.type === "Superset") {
          const subs = Array.isArray(d.superset_items) ? d.superset_items : [];
          const mappedSubs: SupersetSubOut[] = subs.map((s: any) => ({
            exercise_id: String(s.exercise_id || ""),
            exercise_name: typeof s.exercise_name === "string" ? s.exercise_name : undefined,
            reps: s.reps ?? null,
            weight_kg: s.weight_kg ?? null,
          }));
          items.push({
            type: "Superset",
            order: Number(d.order ?? 0),
            name: d.name ?? null,
            items: mappedSubs,
            sets: d.sets ?? null,
            rest_s: d.rest_s ?? null,
            notes: d.notes ?? null,
          });
        }
      });
      return items;
    }

    // Build up to three rounds by category order (we wrote as Gym, order 1..n)
    // We don't rely on any category; we just take in order and then map to warmup/main/finisher.
    const roundDocs = roundsSnap.docs.sort((a, b) => (Number(a.data().order || 0) - Number(b.data().order || 0)));
    const roundBlocks: GymRoundOut[] = [];
    for (const rDoc of roundDocs) {
      const r = rDoc.data() || {};
      const items = await loadItems(rDoc);
      roundBlocks.push({
        name: String(r.name || "Round"),
        order: Number(r.order || 0),
        items,
      });
    }

    // Decide warmup / main / finisher
    let warmup: GymRoundOut | null = null;
    let main: GymRoundOut | null = null;
    let finisher: GymRoundOut | null = null;
    if (roundBlocks.length === 1) {
      main = roundBlocks[0];
    } else if (roundBlocks.length === 2) {
      warmup = roundBlocks[0];
      main = roundBlocks[1];
    } else if (roundBlocks.length >= 3) {
      warmup = roundBlocks[0];
      main = roundBlocks[1];
      finisher = roundBlocks[2];
    }

    const created_at = w.created_at?.toDate?.()?.toISOString?.() || null;
    const updated_at = w.updated_at?.toDate?.()?.toISOString?.() || null;

    const payload: GymWorkoutOut = {
      workout_id: rootId,
      workout_name: String(w.workout_name || "Workout"),
      focus: w.focus ?? null,
      notes: w.notes ?? null,
      video_url: w.video_url ?? null,
      warmup,
      main: main || { name: "Main Set", order: 1, items: [] },
      finisher,
      created_at,
      updated_at,
    };

    res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("[api/workouts/[id]] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load workout" });
  }
}
