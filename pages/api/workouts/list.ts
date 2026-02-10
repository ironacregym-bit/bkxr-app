// pages/api/workouts/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb as db } from "../../../lib/firebaseAdmin";

/**
 * Returns a lightweight list of workouts for the library page.
 * Query params:
 *  - limit?: number (default 200)
 *  - q?: string (case-insensitive search against workout_name/focus)
 *  - visibility?: "global" | "private"
 *
 * Response:
 *  {
 *    items: Array<{
 *      workout_id: string;
 *      workout_name: string;
 *      visibility?: "global" | "private";
 *      focus?: string;
 *      notes?: string;
 *      kind: "gym" | "bxkr" | "unknown";
 *      owner_email?: string;
 *      created_at?: any;
 *    }>
 *  }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { limit: limitRaw, q, visibility } = req.query;
    const limit = Math.max(1, Math.min(500, Number(limitRaw) || 200));

    let ref = db.collection("workouts").limit(limit);

    // Server-side filter by visibility if provided
    if (visibility === "global" || visibility === "private") {
      ref = ref.where("visibility", "==", visibility);
    }

    // Basic return set
    const snap = await ref.get();

    const items: any[] = [];
    for (const doc of snap.docs) {
      const base = doc.data() || {};
      // Heuristic "kind": prefer explicit flags if present; otherwise inspect shape fields
      let kind: "gym" | "bxkr" | "unknown" = "unknown";

      // If the document stored consolidated fields for BXKR
      if (base?.boxing && base?.kettlebell) {
        kind = "bxkr";
      } else {
        // If it has subcollection "rounds", it's very likely a Gym workout
        // (we won't call nested subcollection reads in the list API for perf)
        // Some implementations store a snapshot of rounds count on base (optional)
        if (typeof base?.rounds_count === "number" && base.rounds_count > 0) {
          kind = "gym";
        } else {
          // Last try: if this workout was created by your gym-create API,
          // it might keep normalized top-level warmup/main/finisher:
          if (base?.main || base?.warmup || base?.finisher) {
            kind = "gym";
          }
        }
      }

      items.push({
        workout_id: doc.id,
        workout_name: base?.workout_name || "(Untitled)",
        visibility: base?.visibility || "global",
        focus: base?.focus || "",
        notes: base?.notes || "",
        owner_email: base?.owner_email || "",
        created_at: base?.created_at || base?.createdAt || null,
        kind,
      });
    }

    // Client-side search (simple contains on lower-cased fields)
    let filtered = items;
    if (q && String(q).trim().length > 0) {
      const needle = String(q).toLowerCase();
      filtered = items.filter((w) => {
        return (
          String(w.workout_name || "").toLowerCase().includes(needle) ||
          String(w.focus || "").toLowerCase().includes(needle)
        );
      });
    }

    // Sort: newest first if created_at exists; otherwise by name
    filtered.sort((a, b) => {
      const at = a.created_at?._seconds || 0;
      const bt = b.created_at?._seconds || 0;
      if (bt !== at) return bt - at;
      return String(a.workout_name || "").localeCompare(String(b.workout_name || ""));
    });

    return res.status(200).json({ items: filtered });
  } catch (err: any) {
    console.error("[workouts/list] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to list workouts" });
  }
}
