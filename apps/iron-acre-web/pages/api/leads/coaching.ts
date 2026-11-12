import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../../../../lib/firebase";

import {
  sendCoachingApplicationNotification,
  sendCoachingApplicationReceivedEmail,
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
      source = "coaching",
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        error:
          "Name and email are required",
      });
    }

    const docRef = await addDoc(
      collection(
        db,
        "iron-acre-web_coaching_leads"
      ),
      {
        name,
        email,
        source,
        status: "new",
        createdAt:
          serverTimestamp(),
      }
    );

    await sendCoachingApplicationNotification(
      {
        name,
        email,
      }
    );

    await sendCoachingApplicationReceivedEmail(
      {
        name,
        email,
      }
    );

    return res.status(200).json({
      success: true,
      id: docRef.id,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        "Failed to create coaching lead",
    });
  }
}
