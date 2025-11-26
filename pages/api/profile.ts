// pages/api/profile.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../lib/firestoreClient"; // Using Google Cloud Firestore client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = req.query.email as string;
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    // Fetch user document by email (document ID = email)
    const docRef = firestore.collection("users").doc(email);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Convert Firestore data to plain object
    const profileData = docSnap.data() || {};

    // Ensure response matches original format (key-value pairs)
    return res.status(200).json(profileData);
  } catch (err: any) {
    console.error("Firestore read failed:", err.message);
    return res.status(500).json({ error: "Failed to load profile" });
  }
}
