import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

type Body = {
  name?: string;
  email?: string;
  phone?: string;
  interested_classes?: string[];
  preferred_times?: string[];
  sessions_per_week?: string;
  biggest_goal?: string;
  referral_name?: string;
  referral_contact?: string;
  consent_to_contact?: boolean;
};

function cleanString(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

function cleanArray(v: any): string[] {
  return Array.isArray(v)
    ? v.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true; id: string } | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body: Body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const name = cleanString(body.name);
    const email = cleanString(body.email).toLowerCase();
    const phone = cleanString(body.phone);

    const interested_classes = cleanArray(body.interested_classes);
    const preferred_times = cleanArray(body.preferred_times);
    const sessions_per_week = cleanString(body.sessions_per_week);
    const biggest_goal = cleanString(body.biggest_goal);

    const referral_name = cleanString(body.referral_name);
    const referral_contact = cleanString(body.referral_contact);

    const consent_to_contact = body.consent_to_contact === true;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!interested_classes.length) {
      return res.status(400).json({ error: "At least one class must be selected" });
    }

    if (!preferred_times.length) {
      return res.status(400).json({ error: "At least one preferred time must be selected" });
    }

    if (!sessions_per_week) {
      return res.status(400).json({ error: "Sessions per week is required" });
    }

    if (!biggest_goal) {
      return res.status(400).json({ error: "Biggest goal is required" });
    }

    if (!consent_to_contact) {
      return res.status(400).json({ error: "Consent is required" });
    }

    const now = Timestamp.now();
    const docRef = firestore.collection("founders_interest").doc();

    await docRef.set({
      id: docRef.id,
      source: "founders_page",
      name,
      email,
      phone: phone || null,
      interested_classes,
      preferred_times,
      sessions_per_week,
      biggest_goal,
      referral_name: referral_name || null,
      referral_contact: referral_contact || null,
      consent_to_contact,
      created_at: now,
      updated_at: now,
    });

    return res.status(200).json({
      ok: true,
      id: docRef.id,
    });
  } catch (err: any) {
    console.error("[founders/submit] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to submit founders form" });
  }
}
