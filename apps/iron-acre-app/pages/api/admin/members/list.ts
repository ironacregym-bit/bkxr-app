import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { hasRole } from "../../../../lib/rbac";

/**
 * Admin Members List (filtered)
 * - Returns only "real" users:
 *   • doc id looks like an email (contains "@")
 *   • OR has a visible name (display_name | name | profile.name)
 *
 * Pagination:
 * - We over-fetch and filter in memory until we accumulate `limit` results
 *   or run out of docs. `nextCursor` remains the last fetched doc id (unfiltered),
 *   which keeps pagination stable even when many docs are filtered out.
 *
 * Optional query params:
 * - limit: number (<=100)
 * - cursor: string (last doc id)
 * - include_hash=1 (optional) → if present, returns ALL users (disables filtering)
 */

const MAX_FETCH_ROUNDS = 8; // safety guard to avoid long loops when everything is filtered out

function isLikelyEmail(id: string): boolean {
  // very light check; we just need to exclude hash-like ids
  return typeof id === "string" && id.includes("@") && id.includes(".");
}

function extractName(data: any): string | null {
  if (!data || typeof data !== "object") return null;
  return (
    data.display_name ||
    data.name ||
    (data.profile && data.profile.name) ||
    null
  );
}

function normaliseUpdatedAt(u: any): string | null {
  if (!u) return null;
  try {
    if (typeof u?.toDate === "function") return u.toDate().toISOString();
    if (typeof u === "string") return u;
  } catch {}
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const rawLimit = Number(req.query.limit || 50);
  const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 50, 100);
  let cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
  const includeHash = String(req.query.include_hash || "") === "1";

  try {
    // We may need multiple fetches to gather enough filtered results.
    const results: {
      email: string;
      name: string | null;
      membership_status: string | null;
      subscription_status: string | null;
      updated_at: string | null;
    }[] = [];

    let rounds = 0;
    let lastFetchedDocId: string | null = null;
    let exhausted = false;

    while (results.length < limit && rounds < MAX_FETCH_ROUNDS && !exhausted) {
      rounds++;

      // Fetch a chunk (oversize to compensate for filtering)
      const chunkSize = Math.min(limit * 3, 300); // cap to keep memory & latency sane
      let q: FirebaseFirestore.Query = firestore.collection("users").orderBy("__name__").limit(chunkSize);
      if (cursor) q = q.startAfter(cursor);

      const snap = await q.get();
      if (snap.empty) {
        exhausted = true;
        break;
      }

      const docs = snap.docs;
      lastFetchedDocId = docs[docs.length - 1]?.id || null;

      for (const d of docs) {
        const data = d.data() || {};
        const name = extractName(data);
        const membership_status = data.membership_status || null;
        const subscription_status = data.subscription_status || null;
        const updated_at = normaliseUpdatedAt(data.updated_at);

        const item = {
          email: d.id,
          name,
          membership_status,
          subscription_status,
          updated_at,
        };

        if (includeHash) {
          results.push(item);
        } else {
          // Filter: only emails OR has any visible name
          if (isLikelyEmail(d.id) || (name && String(name).trim().length > 0)) {
            results.push(item);
          }
        }

        if (results.length >= limit) break;
      }

      // Advance cursor for next loop if needed
      cursor = lastFetchedDocId;

      // If we fetched fewer than chunkSize, we've hit the end
      if (docs.length < chunkSize) {
        exhausted = true;
      }
    }

    const nextCursor = exhausted ? null : cursor;

    return res.status(200).json({
      items: results.slice(0, limit),
      nextCursor,
      filtered: includeHash ? false : true,
    });
  } catch (err) {
    console.error("[admin/members/list] error:", (err as any)?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
}
