// pages/api/nutrition/saved-meals.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type SavedMealItem = {
  food: any;
  grams?: number | string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type SavedMealPayload = {
  name?: string;
  source_meal?: string;
  items?: SavedMealItem[];
};

function nowIso() {
  return new Date().toISOString();
}

function cleanNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function cleanNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getTotals(items: SavedMealItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.calories += cleanNumber(item.calories);
      acc.protein += cleanNumber(item.protein);
      acc.carbs += cleanNumber(item.carbs);
      acc.fat += cleanNumber(item.fat);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userEmail = String(session.user.email || "").trim();

  if (!userEmail) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const itemsRef = firestore
    .collection("nutrition_saved_meals")
    .doc(userEmail)
    .collection("items");

  if (req.method === "GET") {
    try {
      const limitParam = Number(req.query.limit);
      const limit = Number.isFinite(limitParam)
        ? Math.max(1, Math.min(50, limitParam))
        : 30;

      const snap = await itemsRef.orderBy("updated_at", "desc").limit(limit).get();

      const meals = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json({ meals });
    } catch (err: any) {
      console.error("[nutrition/saved-meals][GET]", err?.message || err);
      return res.status(500).json({ error: "Failed to load saved meals" });
    }
  }

  if (req.method === "POST") {
    try {
      const body = (req.body || {}) as SavedMealPayload;

      const sourceMeal = String(body.source_meal || "").trim() || "Meal";
      const name = String(body.name || "").trim() || sourceMeal;
      const rawItems = Array.isArray(body.items) ? body.items : [];

      const items = rawItems
        .filter((item) => item && item.food)
        .map((item) => ({
          food: item.food,
          grams: cleanNullableNumber(item.grams),
          calories: cleanNumber(item.calories),
          protein: cleanNumber(item.protein),
          carbs: cleanNumber(item.carbs),
          fat: cleanNumber(item.fat),
        }));

      if (!items.length) {
        return res.status(400).json({ error: "A saved meal needs at least one item" });
      }

      const timestamp = nowIso();
      const totals = getTotals(items);

      const payload = {
        name,
        source_meal: sourceMeal,
        items,
        item_count: items.length,
        totals,
        created_at: timestamp,
        updated_at: timestamp,
        last_used_at: null,
      };

      const ref = await itemsRef.add(payload);
      const created = await ref.get();

      return res.status(201).json({
        id: ref.id,
        ...created.data(),
      });
    } catch (err: any) {
      console.error("[nutrition/saved-meals][POST]", err?.message || err);
      return res.status(500).json({ error: "Failed to save meal" });
    }
  }

  if (req.method === "PATCH") {
    try {
      const id = String(req.query.id || req.body?.id || "").trim();

      if (!id) {
        return res.status(400).json({ error: "Missing saved meal id" });
      }

      const ref = itemsRef.doc(id);
      const snap = await ref.get();

      if (!snap.exists) {
        return res.status(404).json({ error: "Saved meal not found" });
      }

      const timestamp = nowIso();

      await ref.set(
        {
          last_used_at: timestamp,
          updated_at: timestamp,
        },
        { merge: true }
      );

      return res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error("[nutrition/saved-meals][PATCH]", err?.message || err);
      return res.status(500).json({ error: "Failed to update saved meal" });
    }
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
