import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

/** Normalise digits only */
function digits(s: string) {
  return String(s || "").replace(/\D/g, "");
}

/** EAN/UPC checksum validators */
function isValidEAN13(d: string) {
  if (d.length !== 13) return false;
  const sum = d
    .slice(0, 12)
    .split("")
    .reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[12]);
}
function isValidEAN8(d: string) {
  if (d.length !== 8) return false;
  const sum = d
    .slice(0, 7)
    .split("")
    .reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 3 : 1), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[7]);
}
function isValidUPCA(d: string) {
  if (d.length !== 12) return false;
  const odds = d
    .slice(0, 11)
    .split("")
    .reduce((acc, ch, i) => acc + (i % 2 === 0 ? Number(ch) : 0), 0);
  const evens = d
    .slice(0, 11)
    .split("")
    .reduce((acc, ch, i) => acc + (i % 2 === 1 ? Number(ch) : 0), 0);
  const sum = odds * 3 + evens;
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[11]);
}
function isValidEAN14(d: string) {
  if (d.length !== 14) return false;
  const sum = d
    .slice(0, 13)
    .split("")
    .reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 3 : 1), 0);
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

/**
 * POST /api/foods/upsert-barcode
 * Body:
 *   { code, name, brand?, image?, calories, protein, carbs, fat, servingSize?, scope?: "global"|"user" }
 * Rules:
 *   - admin/gym can write scope="global" -> collection("barcode_foods").doc(code)
 *   - others write to user scope -> collection("user_barcode_foods/{email}/foods/{code}")
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

    const role = (session.user as any)?.role || "user";
    const email = String(session.user.email).toLowerCase();

    const {
      code,
      name,
      brand = "",
      image = null,
      calories = 0,
      protein = 0,
      carbs = 0,
      fat = 0,
      servingSize = null,
      scope = "user", // default: user-owned entry
    } = req.body || {};

    if (!code || !name) return res.status(400).json({ error: "code and name are required" });

    const norm = validateAndNormalise(code);
    if (!norm) return res.status(400).json({ error: "Invalid barcode or checksum failed" });

    const now = Timestamp.now();
    const record = {
      name: String(name).trim(),
      brand: String(brand || "").trim(),
      image: image || null,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      servingSize: servingSize ? String(servingSize) : null,
      updated_at: now,
    };

    const allowGlobal = role === "admin" || role === "gym";

    if (scope === "global" && allowGlobal) {
      const ref = firestore.collection("barcode_foods").doc(norm);
      const snap = await ref.get();
      await ref.set(
        {
          ...record,
          source: snap.exists ? snap.get("source") || "admin" : "admin",
          created_at: snap.exists ? snap.get("created_at") || now : now,
        },
        { merge: true }
      );
      return res.status(200).json({ ok: true, code: norm, scope: "global" });
    }

    // user scoped
    const ref = firestore
      .collection("user_barcode_foods")
      .doc(email)
      .collection("foods")
      .doc(norm);
    const snap = await ref.get();
    await ref.set(
      {
        ...record,
        source: "user",
        created_at: snap.exists ? snap.get("created_at") || now : now,
      },
      { merge: true }
    );
    return res.status(200).json({ ok: true, code: norm, scope: "user" });
  } catch (e: any) {
    console.error("[foods/upsert-barcode] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to upsert barcode food" });
  }
}
