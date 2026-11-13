import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import firestore from "@/lib/firestoreClient";

import {
  sendLeadNotification,
  sendFreeProgramEmail,
} from "../../lib/lead-emails";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const {
      name,
      email,
      source = "hero",
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        error: "Name and email are required",
      });
    }

    const docRef = await firestore
      .collection("iron-acre-web_leads")
      .add({
        name,
        email,
        source,
        status: "new",
        createdAt: new Date(),
      });

    await sendLeadNotification({
      name,
      email,
      source,
    });

    await sendFreeProgramEmail({
      name,
      email,
    });

    return res.status(200).json({
      success: true,
      id: docRef.id,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to create lead",
    });
  }
}
