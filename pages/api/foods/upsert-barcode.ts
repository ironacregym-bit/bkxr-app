// pages/api/foods/upsert-barcode.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

/** Digits only */
function digits(s: string) {
  return String(s || "").replace(/\D/g, "");
}

/** EAN/UPC checksum validators (GTIN-8/12/13/14) */
function isValidEAN13(d: string) {
  if (d.length !== 13) return false;
  const sum = d.slice(0, 12).split("").reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[12]);
}
function isValidEAN8(d: string) {
  if (d.length !== 8) return false;
  const sum = d.slice(0, 7).split("").reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 3 : 1), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[7]);
}
function isValidUPCA(d: string) {
  if (d.length !== 12) return false;
  const odds = d.slice(0, 11).split("").reduce((acc, ch, i) => acc + (i % 2 === 0 ? Number(ch) : 0), 0);
  const evens = d.slice(0, 11).split("").reduce((acc, ch, i) => acc + (i % 2 === 1 ? Number(ch) : 0), 0);
  const sum = odds * 3 + evens;
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[11]);
}
function isValidEAN14(d: string) {
  if (d.length !== 14) return false;
  const sum = d.slice(0, 13).split("").reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 3 : 1), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[13]);
}
function validateAndNormalise(raw: string) {
  const d = digits(raw);
  if (d.length === 8 && isValidEAN8(d)) return d;
  if (d.length === 12 && isValidUPCA(d)) return d;
  if (d.length === 13 && isValidEAN13(d)) return d;
  if (d.length === 14 && isValidEAN14(d)) return d;
  return null;
}

function toNum(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** Tolerant grams parser */
function parseServingGrams(servingSize?: string | null): number | null {
  if (servingSize == null) return null;
  const raw = String(servingSize).trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const m1 = raw.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (m1) {
    const n = Number(m1[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const m2 = raw.match(/\((\d+(?:\.\d+)?)\s*g\)/i);
  if (m2) {
    const n = Number(m2[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

type FoodDTO = {
  id: string;
  code: string;
  name: string;
  brand: string;
  image: string | null;
  calories: number; // per-100g baseline
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string | null;
  caloriesPerServing?: number | null;
  proteinPerServing?: number | null;
  carbsPerServing?: number | null;
  fatPerServing?: number | null;
};

type Incoming = {
  code: string;
  name: string;
  brand?: string | null;
  image?: string | null;
  servingSize?: string | null;
  // ambiguous: treat as per-serving iff serving grams present, else per-100g
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

    const email = String(session.user.email || "").toLowerCase();

    const body = (req.body || {}) as Incoming;
    if (!body.code || !body.name) return res.status(400).json({ error: "code and name are required" });

    const code = validateAndNormalise(body.code);
    if (!code) return res.status(400).json({ error: "Invalid barcode or checksum failed" });

    const now = Timestamp.now();
    const servingSize = body.servingSize ? String(body.servingSize) : null;
    const g = parseServingGrams(servingSize);

    // Interpret incoming numbers
    const aC = toNum(body.calories);
    const aP = toNum(body.protein);
    const aCh = toNum(body.carbs);
    const aF = toNum(body.fat);

    let c100 = 0, p100 = 0, ch100 = 0, f100 = 0;
    let cServ: number | null = null, pServ: number | null = null, chServ: number | null = null, fServ: number | null = null;

    if (g && g > 0) {
      // Treat incoming as per-serving if grams are provided
      cServ = aC;
      pServ = aP;
      chServ = aCh;
      fServ = aF;

      c100 = +((aC * 100) / g).toFixed(2);
      p100 = +((aP * 100) / g).toFixed(2);
      ch100 = +((aCh * 100) / g).toFixed(2);
      f100 = +((aF * 100) / g).toFixed(2);
    } else {
      // No grams => treat incoming as per-100g baseline
      c100 = aC;
      p100 = aP;
      ch100 = aCh;
      f100 = aF;

      // If grams arrive later (edits), perServing can be derived then
      cServ = null; pServ = null; chServ = null; fServ = null;
    }

    const ref = firestore.collection("barcode_foods").doc(code);
    const snap = await ref.get();

    await ref.set(
      {
        name: String(body.name).trim(),
        brand: String(body.brand || "").trim(),
        image: body.image ? String(body.image) : null,
        servingSize: servingSize,

        // Explicit blocks (clarity & future-proof)
        per100: { calories: c100, protein: p100, carbs: ch100, fat: f100 },
        ...(cServ != null || pServ != null || chServ != null || fServ != null
          ? { perServing: { calories: cServ ?? 0, protein: pServ ?? 0, carbs: chServ ?? 0, fat: fServ ?? 0 } }
          : { perServing: null }),

        // Flat fields for back-compat (baseline = per-100g)
        calories: c100,
        protein: p100,
        carbs: ch100,
        fat: f100,
        caloriesPerServing: cServ ?? null,
        proteinPerServing: pServ ?? null,
        carbsPerServing: chServ ?? null,
        fatPerServing: fServ ?? null,

        basis: "per100", // baseline choice for flat fields
        source: snap.exists ? snap.get("source") || "user" : "user",
        created_at: snap.exists ? snap.get("created_at") || now : now,
        created_by: snap.exists ? snap.get("created_by") || email : email,
        updated_at: now,
      },
      { merge: true }
    );

    const dto: FoodDTO = {
      id: code,
      code,
      name: String(body.name).trim(),
      brand: String(body.brand || "").trim(),
      image: body.image ? String(body.image) : null,
      calories: c100,
      protein: p100,
      carbs: ch100,
      fat: f100,
      servingSize: servingSize || "",
      caloriesPerServing: cServ ?? null,
      proteinPerServing: pServ ?? null,
      carbsPerServing: chServ ?? null,
      fatPerServing: fServ ?? null,
    };

    return res.status(200).json({ ok: true, code, scope: "global", food: dto });
  } catch (e: any) {
    console.error("[foods/upsert-barcode] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to upsert barcode food" });
  }
}
