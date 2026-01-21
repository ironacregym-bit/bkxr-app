
// pages/api/shopping/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Item = {
  id?: string;
  name: string;
  qty?: number | null;
  unit?: string | null;
  done?: boolean;
  list_id?: string | null;
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
  title?: string;
  servings?: number;
  ingredients?: RecipeIngredient[];
  items?: RecipeIngredient[]; // fallback key
};

const isoNow = () => new Date().toISOString();
const toNumber = (x: any, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);
const normaliseName = (s: string) => String(s || "").trim().toLowerCase();
const keyFor = (name: string, unit?: string | null) =>
  `${normaliseName(name)}__${(unit || "").trim().toLowerCase()}`;

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
): Promise<{ ok: true; items: Item[]; title: string } | { ok: false; error: string }> {
  const doc = await firestore.collection("recipes").doc(recipeId).get();
  if (!doc.exists) return { ok: false, error: "Recipe not found" };
  const data = (doc.data() || {}) as RecipeDoc;

  const title = String(data.title || "Recipe");
  const baseServings = toNumber((data.servings as any) ?? 1, 1);
  const list = Array.isArray(data.ingredients) ? data.ingredients : Array.isArray(data.items) ? data.items : [];
  if (!Array.isArray(list) || list.length === 0) return { ok: false, error: "Recipe has no ingredients" };

  const factor = Math.max(1, people) / (baseServings > 0 ? baseServings : 1);
  const scaled: Item[] = [];

  for (const row of list) {
    const parsed = readIngredientRow(row);
    if (!parsed) continue;
    const scaledQty = parsed.qty != null ? parsed.qty * factor : null;
    scaled.push({
      name: parsed.name,
      qty: scaledQty != null ? Number(scaledQty.toFixed(2)) : null,
      unit: parsed.unit ?? null,
    });
  }

  // Merge dupes within one expansion
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

  return { ok: true, items: Object.values(merged), title };
}

async function upsertItemsMerge(
  itemsCollRef: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>,
  incoming: Item[],
  listId?: string
): Promise<{ added: number; updated: number }> {
  if (!incoming.length) return { added: 0, updated: 0 };

  // Load existing items once and build a map; match within same list only
  const existingSnap = await itemsCollRef.get();
  const existing: Array<{ id: string; name: string; unit: string | null; qty: number | null; list_id?: string | null }> =
    existingSnap.docs.map((d) => {
      const x = d.data() as any;
      return { id: d.id, name: x.name || "", unit: x.unit ?? null, qty: x.qty ?? null, list_id: x.list_id ?? null };
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

    const found = existing.find(
      (x) => x.name === name && x.unit === unit && (!listId || x.list_id === listId)
    );

    if (found) {
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
        list_id: listId || null,
        added_at: now,
        updated_at: now,
      });
      added++;
    }
  }

  if (added + updated > 0) await batch.commit();
  return { added, updated };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  // Items collection for the user (existing)
  const coll = firestore.collection("shopping_lists").doc(email).collection("items");
  // Lists collection for recording attached meals (additive)
  const listsCol = firestore.collection("shopping_lists").doc(email).collection("lists");

  try {
    // -------------------- GET --------------------
    if (req.method === "GET") {
      const listId = (req.query.list_id as string) || "";
      if (listId) {
        const snap = await coll
          .where("list_id", "==", listId)
          .orderBy("added_at", "desc")
          .limit(500)
          .get();
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        return res.status(200).json({ items });
      }
      // Back‑compat: no filter = latest items
      const snap = await coll.orderBy("added_at", "desc").limit(200).get();
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return res.status(200).json({ items });
    }

    // -------------------- POST --------------------
    if (req.method === "POST") {
      const body = (req.body || {}) as any;
      const action: string = typeof body.action === "string" ? body.action.trim() : "";
      const listId = typeof body.list_id === "string" && body.list_id.trim() ? body.list_id.trim() : "";

      // Bulk foods
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

        const { added, updated } = await upsertItemsMerge(coll, incoming, listId || undefined);
        const snap = listId
          ? await coll.where("list_id", "==", listId).orderBy("added_at", "desc").limit(500).get()
          : await coll.orderBy("added_at", "desc").limit(200).get();
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        return res.status(200).json({ ok: true, added, updated, items });
      }

      // Single recipe
      if (action === "addRecipe") {
        const recipeId = String(body.recipe_id || "").trim();
        if (!recipeId) return res.status(400).json({ error: "recipe_id required" });
        const people = toNumber(body.people, 1);

        const ex = await expandRecipeIngredients(recipeId, people);
        if (!ex.ok) return res.status(400).json({ error: ex.error });

        // Attach the meal to the list (if list_id provided)
        if (listId) {
          const listDoc = await listsCol.doc(listId).get();
          if (listDoc.exists) {
            await listsCol.doc(listId).collection("recipes").add({
              recipe_id: recipeId,
              title: ex.title,
              people,
              added_at: isoNow(),
            });
            await listsCol.doc(listId).set({ updated_at: isoNow() }, { merge: true });
          }
        }

        const { added, updated } = await upsertItemsMerge(coll, ex.items, listId || undefined);
        const snap = listId
          ? await coll.where("list_id", "==", listId).orderBy("added_at", "desc").limit(500).get()
          : await coll.orderBy("added_at", "desc").limit(200).get();
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        return res.status(200).json({ ok: true, added, updated, items });
      }

      // Multiple recipes
      if (action === "addRecipes") {
        const itemsArr = Array.isArray(body.items) ? (body.items as any[]) : [];
        if (!itemsArr.length) return res.status(400).json({ error: "items array required" });

        const aggregated: Item[] = [];
        for (const row of itemsArr) {
          const rid = String(row?.recipe_id || "").trim();
          if (!rid) continue;
          const ppl = toNumber(row?.people, 1);
          const ex = await expandRecipeIngredients(rid, ppl);
          if (ex.ok) {
            aggregated.push(...ex.items);
            if (listId) {
              await listsCol.doc(listId).collection("recipes").add({
                recipe_id: rid,
                title: ex.title,
                people: ppl,
                added_at: isoNow(),
              });
            }
          }
        }
        if (!aggregated.length) return res.status(400).json({ error: "No valid recipe expansions" });

        if (listId) await listsCol.doc(listId).set({ updated_at: isoNow() }, { merge: true });

        const { added, updated } = await upsertItemsMerge(coll, aggregated, listId || undefined);
        const snap = listId
          ? await coll.where("list_id", "==", listId).orderBy("added_at", "desc").limit(500).get()
          : await coll.orderBy("added_at", "desc").limit(200).get();
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        return res.status(200).json({ ok: true, added, updated, items });
      }

      // Back‑compat: single item add (optionally for a list)
      const { name, qty, unit } = body as { name?: string; qty?: number | null; unit?: string | null };
      if (!name || !String(name).trim()) return res.status(400).json({ error: "name required" });
      const doc = coll.doc();
      await doc.set(
        {
          name: String(name).trim(),
          qty: typeof qty === "number" ? qty : null,
          unit: unit ? String(unit) : null,
          done: false,
          list_id: listId || null,
          added_at: isoNow(),
          updated_at: isoNow(),
        },
        { merge: true }
      );
      return res.status(200).json({ ok: true, id: doc.id });
    }

    // -------------------- PATCH --------------------
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

    // -------------------- DELETE --------------------
    if (req.method === "DELETE") {
      const { id } = (req.body || {}) as { id?: string };
      if (!id) return res.status(400).json({ error: "id required" });
      await coll.doc(id).delete();
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    // Minimal logging without PII
    console.error("[shopping/list]", e?.message || e);
    return res.status(500).json({ error: "Shopping list error" });
  }
}
