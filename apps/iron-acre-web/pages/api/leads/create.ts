import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { firestore } from "@pt/firebase";
import { sendLeadEmails } from "../../../lib/lead-emails";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof source !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      email.trim().length > 254
    ) {
      return res.status(400).json({
        error: "Name and email are required",
      });
    }

    const docRef = await firestore
      .collection("iron-acre-web_leads")
      .add({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        source: source.trim().slice(0, 80),
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

    const emailDelivery =
      await sendLeadEmails({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        source: source.trim().slice(0, 80),
        campaign:
          source.trim() === "winter-arc-2027"
            ? "winter-arc-2027"
            : "free-program",
      });

    try {
      await docRef.set(
        {
          emailDelivery,
          emailUpdatedAt: new Date(),
          welcomeEmailSent:
            emailDelivery.confirmationSent,
        },
        { merge: true }
      );
    } catch (emailStatusError) {
      console.error(
        "Failed to update lead email status",
        emailStatusError
      );
    }

    return res.status(200).json({
      success: true,
      id: docRef.id,
      emailStatus: emailDelivery.status,
      confirmationEmailSent:
        emailDelivery.confirmationSent,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to create lead",
    });
  }
}
