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
      source = "coaching",
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
      .collection("iron-acre-web_coaching_leads")
      .add({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        source: source.trim().slice(0, 80),
        status: "new",
        applicationEmailSent: false,
        reviewed: false,
        createdAt: new Date(),
      });

    const emailDelivery =
      await sendLeadEmails({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        source: source.trim().slice(0, 80),
        campaign: "coaching",
      });

    try {
      await docRef.set(
        {
          emailDelivery,
          emailUpdatedAt: new Date(),
          applicationEmailSent:
            emailDelivery.confirmationSent,
        },
        { merge: true }
      );
    } catch (emailStatusError) {
      console.error(
        "Failed to update coaching email status",
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
      error:
        "Failed to create coaching lead",
    });
  }
}
