// pages/api/boxing-combos/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

const ALLOWED_CATEGORIES = ["Basics", "Speed", "Power", "Defensive", "Engine"] as const;
const ALLOWED_PUNCH = ["jab", "cross", "lead_hook", "rear_hook", "lead_uppercut", "rear_uppercut", "hook", "uppercut"] as const;
const ALLOWED_DEF = ["slip", "roll", "parry", "duck"] as const;

function validateActions(actions: any[]) {
  if (!Array.isArray(actions) || actions.length < 1) throw new Error("actions must be a non-empty array");
  if (actions.length > 5) throw new Error("actions max length is 5");

  actions.forEach((a, i) => {
    if (!a?.kind || !["punch", "defence"].includes(a.kind)) {
      throw new Error(`Invalid kind at actions[${i}]`);
    }
    if (!a?.code || typeof a.code !== "string") throw new Error(`Missing code at actions[${i}]`);

    if (a.kind === "punch" && !ALLOWED_PUNCH.includes(a.code)) {
      throw new Error(`Invalid punch code at actions[${i}]`);
    }
    if (a.kind === "defence" && !ALLOWED_DEF.includes(a.code)) {
      throw new Error(`Invalid defence code at actions[${i}]`);
    }
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  const userEmail = session?.user?.email || "";
  if (!userEmail || (role !== "admin" && role !== "gym")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { id, combo_name, category, difficulty, video_url, notes, actions } = req.body || {};

    if (!combo_name || typeof combo_name !== "string") {
      return res.status(400).json({ error: "combo_name is required" });
    }

    const idRaw = (typeof id === "string" && id.trim().length > 0) ? id : combo_name;
    const docId = String(idRaw).trim();
    if (!docId) return res.status(400).json({ error: "combo_id resolved empty" });
    if (docId.length > 200) return res.status(400).json({ error: "combo_id too long (max 200 chars)" });

    const cat = String(category || "").trim();
    if (!ALLOWED_CATEGORIES.includes(cat as any)) {
      return res.status(400).json({ error: "category must be Basics|Speed|Power|Defensive|Engine" });
    }

    validateActions(actions);

    const upsert = String(req.query.upsert || "").toLowerCase() === "true";

    const now = Timestamp.now();
    const ref = firestore.collection("boxing_combos").doc(docId);
    const snap = await ref.get();

    const record: any = {
      combo_name: String(combo_name).trim(),
      category: cat,
      difficulty: typeof difficulty === "number" ? difficulty : (Number.isFinite(Number(difficulty)) ? Number(difficulty) : null),
      video_url: String(video_url || "").trim(),
      notes: String(notes || "").trim(),
      actions,
      updated_at: now,
      last_modified_by: userEmail,
    };

    if (snap.exists) {
      if (!upsert) {
        return res.status(409).json({ error: "Combo already exists", combo_id: docId });
      }
      await ref.set(
        {
          ...record,
          created_at: snap.get("created_at") || now,
          created_by: snap.get("created_by") || userEmail,
        },
        { merge: true }
      );
      return res.status(200).json({ ok: true, combo_id: docId, upserted: true });
    }

    await ref.set({
      ...record,
      created_at: now,
      created_by: userEmail,
    });

    return res.status(201).json({ ok: true, combo_id: docId });
  } catch (err: any) {
    console.error("[boxing-combos/create] error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Failed to create boxing combo" });
  }
}
