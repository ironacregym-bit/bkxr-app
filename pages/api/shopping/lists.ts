
// pages/api/shopping/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

// ---------- Types ----------
type Item = {
  id?: string;
  name: string;
  qty?: number | null;
  unit?: string | null;
  done?: boolean;
  added_at?: string;
  updated_at?: string;
};

type RecipeIngredient = {
  name?: string;
  ingredient?: string;
  title?: string;
  qty?: number;
  quantity?: number;
  amount?: number;
  grams?: number;
  unit?: string;
  uom?: string;
};

type RecipeDoc = {
  servings?: number;
  ingredients?: RecipeIngredient[];
  items?: RecipeIngredient[]; // flexible fallback
  // other fields ignored
};

// ---------- Helpers ----------
const isoNow = () => new Date().toISOString();

function toNumber(x: any, fallback = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseName(name: string): string {
  return String(name || "").trim().toLowerCase();
}

function keyFor(name: string, unit?: string | null): string {
  return `${normaliseName(name)}__${(unit || "").trim().toLowerCase()}`;
}

function readIngredientRow(row: RecipeIngredient): { name: string; qty: number | null; unit: string | null } | null {
  const name = (row.name || row.ingredient || row.title || "").toString().trim();
  if (!name) return null;
  const qtyRaw = row.qty ?? row.quantity ?? row.amount ?? row.grams;
  const qty = qtyRaw != null ? toNumber(qtyRaw, 0) : null;
  const unit = (row.unit || row.uom || (row.grams != null ? "g" : null)) ?? null;
  return { name, qty, unit };
}

async function expandRecipeIngredients(
  recipeId: string,
  people: number
): Promise<{ ok: true; items: Item[] } | { ok: false; error: string }> {
  const doc = await firestore.collection("recipes").doc(recipeId).get();
  if (!doc.exists) return { ok: false, error: "Recipe not found" };
  const data = (doc.data() || {}) as RecipeDoc;

  const baseServings = toNumber((data.servings as any) ?? 1, 1);
  const list = Array.isArray(data.ingredients)
    ? data.ingredients
    : Array.isArray(data.items)
    ? data.items
    : [];

  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, error: "Recipe has no ingredients" };
  }

  const factor = Math.max(0, people) / (baseServings > 0 ? baseServings : 1);
  const scaled: Item[] = [];

  for (const row of list) {
    const parsed = readIngredientRow(row);
    if (!parsed) continue;
    const scaledQty = parsed.qty != null ? parsed.qty * (factor || 1) : null;
    scaled.push({
      name: parsed.name,
      qty: scaledQty != null ? Number(scaledQty.toFixed(2)) : null,
      unit: parsed.unit ?? null,
    });
  }

  // Merge duplicates within this recipe expansion before upsert
  const merged: Record<string, Item> = {};
  for (const it of scaled) {
    const k = keyFor(it.name, it.unit);
    if (!merged[k]) merged[k] = { ...it };
    else {
      const prev = merged[k].qty != null ? merged[k].qty : null;
      const next = it.qty != null ? it.qty : null;
      const sum =
        prev != null && next != null ? Number((prev + next).toFixed(2)) : next != null ? next : prev != null ? prev : null;
      merged[k].qty = sum;
    }
  }

  return { ok: true, items: Object.values(merged) };
}

async function upsertItemsMerge(
  itemsCollRef: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>,
  incoming: Item[]
): Promise<{ added: number; updated: number }> {
  if (!incoming.length) return { added: 0, updated: 0 };

  // Load all existing items (single-user list) and build a key map
  const existingSnap = await itemsCollRef.get();
  const existingByKey = new Map<string, { id: string; name: string; unit: string | null; qty: number | null }>();
  existingSnap.forEach((d) => {
    const data = d.data() as any;
    const name = data.name || "";
    const unit = (data.unit ?? null) as string | null;
    const qty = data.qty ?? null;
    existingByKey.set(keyFor(name, unit), { id: d.id, name, unit, qty });
  });

  let added = 0;
  let updated = 0;
  const batch = firestore.batch();
  const now = isoNow();

  for (const it of incoming) {
    const name = String(it.name || "").trim();
    if (!name) continue;
    const unit = (it.unit ?? null) as string | null;
    const qty = it.qty != null ? toNumber(it.qty, 0) : null;

    const k = keyFor(name, unit);
    const found = existingByKey.get(k);

    if (found) {
      // Sum quantities if both numeric; otherwise prefer provided qty when present
      const prevQty = found.qty != null ? toNumber(found.qty, 0) : null;
      const nextQty =
        prevQty != null && qty != null ? prevQty + qty : qty != null ? qty : prevQty != null ? prevQty : null;

      const ref = itemsCollRef.doc(found.id);
      batch.update(ref, {
        name,
        unit: unit ?? null,
        qty: nextQty ?? null,
        updated_at: now,
      });
      updated++;
    } else {
      const ref = itemsCollRef.doc();
      batch.set(ref, {
        name,
        unit: unit ?? null,
        qty: qty ?? null,
        done: false,
        added_at: now,
        updated_at: now,
      });
      added++;
    }
  }

  if (added + updated > 0) {
    await batch.commit();
  }

  return { added, updated };
}

// ---------- Handler ----------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  // Keep your original collection path unchanged
  const coll = firestore.collection("shopping_lists").doc(email).collection("items");

  try {
    if (req.method === "GET") {
      const snap = await coll.orderBy("added_at", "desc").limit(200).get();
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return res.status(200).json({ items });
    }

    if (req.method === "POST") {
      const body = (req.body || {}) as any;
      const action: string = typeof body.action === "string" ? body.action.trim() : "";

      // --- NEW: addFoods / addRecipe / addRecipes (non-breaking additions) ---
      if (action === "addFoods") {
        const foods = Array.isArray(body.foods) ? (body.foods as any[]) : [];
        if (!foods.length) return res.status(400).json({ error: "foods required" });

        const incoming: Item[] = foods
          .map((f) => ({
            name: String(f.name || "").trim(),
            qty: f.qty != null ? toNumber(f.qty, 0) : null,
            unit: f.unit != null ? String(f.unit) : null,
          }))
          .filter((x) => x.name);

        const { added, updated } = await upsertItemsMerge(coll, incoming);
        const snap = await coll.orderBy("added_at", "desc").limit(200).get();
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        return res.status(200).json({ ok: true, added, updated, items });
      }

      if (action === "addRecipe") {
        const recipeId = String(body.recipe_id || "").trim();
        if (!recipeId) return res.status(400).json({ error: "recipe_id required" });
        const people = toNumber(body.people, 1);

        const ex = await expandRecipeIngredients(recipeId, people);
        if (!ex.ok) return res.status(400).json({ error: ex.error });

        const { added, updated } = await upsertItemsMerge(coll, ex.items);
        const snap = await coll.orderBy("added_at", "desc").limit(200).get();
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        return res.status(200).json({ ok: true, added, updated, items });
      }

      if (action === "addRecipes") {
        const itemsArr = Array.isArray(body.items) ? (body.items as any[]) : [];
        if (!itemsArr.length) return res.status(400).json({ error: "items array required" });

        const aggregated: Item[] = [];
        for (const row of itemsArr) {
          const recipeId = String(row?.recipe_id || "").trim();
          if (!recipeId) continue;
          const people = toNumber(row?.people, 1);
          const ex = await expandRecipeIngredients(recipeId, people);
          if (ex.ok) aggregated.push(...ex.items);
        }
        if (!aggregated.length) return res.status(400).json({ error: "No valid recipe expansions" });

        const { added, updated } = await upsertItemsMerge(coll, aggregated);
        const snap = await coll.orderBy("added_at", "desc").limit(200).get();
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        return res.status(200).json({ ok: true, added, updated, items });
      }

      // --- ORIGINAL behaviour preserved: single item add ---
      const { name, qty, unit } = body as { name?: string; qty?: number | null; unit?: string | null };
      if (!name || !String(name).trim()) return res.status(400).json({ error: "name required" });

      const doc = coll.doc();
      await doc.set(
        {
          name: String(name).trim(),
          qty: typeof qty === "number" ? qty : null,
          unit: unit ? String(unit) : null,
          done: false,
          added_at: isoNow(),
          updated_at: isoNow(),
        },
        { merge: true }
      );
      return res.status(200).json({ ok: true, id: doc.id });
    }

    if (req.method === "PATCH") {
      const { id, done, name, qty, unit } = (req.body || {}) as {
        id?: string;
        done?: boolean;
        name?: string;
        qty?: number | null;
        unit?: string | null;
      };
      if (!id) return res.status(400).json({ error: "id required" });

      const patch: Record<string, any> = {};
      if (typeof done === "boolean") patch.done = done;
      if (typeof name === "string") patch.name = name.trim();
      if (typeof qty === "number") patch.qty = qty;
      if (typeof unit === "string") patch.unit = unit;
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields to update" });

      patch.updated_at = isoNow();
      await coll.doc(id).set(patch, { merge: true });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { id } = (req.body || {}) as { id?: string };
      if (!id) return res.status(400).json({ error: "id required" });
      await coll.doc(id).delete();
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    // Minimal and safe logging (no PII)
    console.error("[shopping/list]", e?.message || e);
    return res.status(500).json({ error: "Shopping list error" });
  }
}
