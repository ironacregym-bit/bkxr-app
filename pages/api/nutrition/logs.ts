import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const userEmail = session.user.email;
  const todayKey = new Date().toISOString().slice(0, 10);

  if (req.method === "GET") {
    const date = (req.query.date as string) || todayKey;
    const snap = await firestore
      .collection("nutrition_logs")
      .doc(userEmail)
      .collection(date)
      .orderBy("created_at", "desc")
      .get();

    const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ entries });
  }

  if (req.method === "POST") {
    const body = req.body;
    if (!body || !body.food) return res.status(400).json({ error: "Missing payload" });

    const date = body.date || todayKey;
    const payload = {
      food: body.food,
      grams: Number(body.grams || 100),
      portionLabel: body.portionLabel || null, // e.g., "1 medium"
      meal: body.meal || "Other",
      calories: Number(body.calories || 0),
      protein: Number(body.protein || 0),
      carbs: Number(body.carbs || 0),
      fat: Number(body.fat || 0),
      created_at: new Date().toISOString(),
    };

    const ref = await firestore
      .collection("nutrition_logs")
      .doc(userEmail)
      .collection(date)
      .add(payload);

    const created = await ref.get();
    return res.status(201).json({ id: ref.id, ...created.data() });
  }

  if (req.method === "DELETE") {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "Missing id" });

    // check today's collection
    const docRef = firestore.collection("nutrition_logs").doc(userEmail).collection(todayKey).doc(id);
    await docRef.delete();
    return res.json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}