import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

const ALLOWED_CATEGORIES = ["Basics", "Speed", "Power", "Defensive", "Engine"] as const;
const ALLOWED_PUNCH = ["jab", "cross", "lead hook", "rear hook", "lead uppercut", "rear uppercut"] as const;
const ALLOWED_DEF = ["slip", "roll", "parry", "duck"] as const;

function assertActions(actions: any[]) {
  if (!Array.isArray(actions) || actions.length < 1) throw new Error("actions must be a non-empty array");
  if (actions.length > 5) throw new Error("actions max length is 5");
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (!a || typeof a !== "object") throw new Error(`actions[${i}] must be an object`);
    if (!a.kind || !["punch", "defence"].includes(a.kind)) throw new Error(`Invalid kind at actions[${i}]`);
    if (!a.code || typeof a.code !== "string") throw new Error(`Missing code at actions[${i}]`);

    if (a.kind === "punch" && !ALLOWED_PUNCH.includes(a.code)) {
      throw new Error(`Invalid punch code '${a.code}' at actions[${i}]`);
    }
    if (a.kind === "defence" && !ALLOWED_DEF.includes(a.code)) {
      throw new Error(`Invalid defence code '${a.code}' at actions[${i}]`);
    }
  }
}

function normaliseOne(raw: any) {
  const combo_name = String(raw?.combo_name || raw?.name || "").trim();
  if (!combo_name) throw new Error("combo_name is required");

  const category = String(raw?.category || "").trim();
  if (!ALLOWED_CATEGORIES.includes(category as any)) {
    throw new Error("category must be one of Basics|Speed|Power|Defensive|Engine");
  }

  const actions = raw?.actions;
  assertActions(actions);

  const difficulty =
    typeof raw?.difficulty === "number"
      ? raw.difficulty
      : Number.isFinite(Number(raw?.difficulty))
      ? Number(raw.difficulty)
      : null;

  const video_url = String(raw?.video_url || "").trim();
  const notes = String(raw?.notes || "").trim();

  // ID rule: doc ID defaults to combo_name
  const id = String(raw?.id || combo_name).trim();
  if (!id) throw new Error("id resolved empty");
  if (id.length > 200) throw new Error("id too long (max 200 chars)");

  return { id, combo_name, category, actions, difficulty, video_url, notes };
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

  const upsert = String(req.query.upsert || "").toLowerCase() === "true";

  try {
    const body = req.body || {};
    const list = Array.isArray(body) ? body : Array.isArray(body.combos) ? body.combos : null;
    if (!list) return res.status(400).json({ error: "Body must be an array, or an object with { combos: [...] }" });
    if (list.length < 1) return res.status(400).json({ error: "No combos provided" });
    if (list.length > 500) return res.status(400).json({ error: "Too many combos in one request (max 500)" });

    const now = Timestamp.now();

    // Validate all first so we fail fast on obvious issues
    const normalised: ReturnType<typeof normaliseOne>[] = [];
    const failures: Array<{ index: number; combo_name?: string; error: string }> = [];

    list.forEach((raw: any, idx: number) => {
      try {
        normalised.push(normaliseOne(raw));
      } catch (e: any) {
        failures.push({ index: idx, combo_name: raw?.combo_name, error: e?.message || "Invalid combo" });
      }
    });

    // If you want “all-or-nothing”, uncomment this
    // if (failures.length) return res.status(400).json({ error: "Validation failed", failures });

    // Batch writes (max 500 ops per batch)
    let created = 0;
    let updated = 0;
    const written: string[] = [];
    const failedWrites: Array<{ id: string; error: string }> = [];

    // Chunk into 400 to leave headroom
    const chunkSize = 400;
    for (let i = 0; i < normalised.length; i += chunkSize) {
      const chunk = normalised.slice(i, i + chunkSize);
      const batch = firestore.batch();

      // Existence checks only if not upserting
      // If upsert, we can just merge and it’s fine.
      if (!upsert) {
        // Check for conflicts
        const snaps = await Promise.all(chunk.map((c) => firestore.collection("boxing_combos").doc(c.id).get()));
        for (let j = 0; j < snaps.length; j++) {
          if (snaps[j].exists) {
            failures.push({ index: i + j, combo_name: chunk[j].combo_name, error: "Already exists (upsert=false)" });
          }
        }
        // Filter out existing if upsert is false
        const filtered = chunk.filter((c, idx2) => !snaps[idx2].exists);
        for (const c of filtered) {
          const ref = firestore.collection("boxing_combos").doc(c.id);
          batch.set(ref, {
            combo_name: c.combo_name,
            category: c.category,
            actions: c.actions,
            difficulty: c.difficulty,
            video_url: c.video_url,
            notes: c.notes,
            created_at: now,
            updated_at: now,
            created_by: userEmail,
            last_modified_by: userEmail,
          });
          created++;
          written.push(c.id);
        }
      } else {
        // Upsert true: merge
        for (const c of chunk) {
          const ref = firestore.collection("boxing_combos").doc(c.id);
          batch.set(
            ref,
            {
              combo_name: c.combo_name,
              category: c.category,
              actions: c.actions,
              difficulty: c.difficulty,
              video_url: c.video_url,
              notes: c.notes,
              updated_at: now,
              last_modified_by: userEmail,
              // created_at/created_by will be set if missing
              created_at: now,
              created_by: userEmail,
            },
            { merge: true }
          );
          // We don’t know if it was created or updated without reading.
          // If you want exact created vs updated, we can read first, but that costs time.
          updated++;
          written.push(c.id);
        }
      }

      try {
        await batch.commit();
      } catch (e: any) {
        // If a commit fails, record chunk failure
        for (const c of chunk) {
          failedWrites.push({ id: c.id, error: e?.message || "Batch commit failed" });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      upsert,
      received: list.length,
      validated: normalised.length,
      created: upsert ? 0 : created,
      updated: upsert ? updated : 0,
      written,
      failures,
      failedWrites,
    });
  } catch (err: any) {
    console.error("[boxing-combos/bulk-create] error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Failed to bulk create boxing combos" });
  }
}
``
