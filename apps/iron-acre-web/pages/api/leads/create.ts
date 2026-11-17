import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import firestore from "../../../../../lib/firestoreClient";

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

        welcomeEmailSent: false,

        day1Sent: false,
        day2Sent: false,
        day3Sent: false,
        day4Sent: false,
        day5Sent: false,
        day6Sent: false,
        day7Sent: false,

        coachingOfferSent: false,

        createdAt: new Date(),
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
