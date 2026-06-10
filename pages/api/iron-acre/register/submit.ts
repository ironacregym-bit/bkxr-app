// pages/api/iron-acre/register/submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import { getStorage } from "firebase-admin/storage";
import { adminDb as db } from "../../../../lib/firebaseAdmin";
import {
  IRON_ACRE_TERMS_VERSION,
  IRON_ACRE_WAIVER_VERSION,
} from "../../../../lib/iron-acre-legal";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

type SubmitBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContact?: {
    name?: string;
    phone?: string;
  };
  parq?: {
    q1?: boolean;
    q2?: boolean;
    q3?: boolean;
    q4?: boolean;
    q5?: boolean;
    q6?: boolean;
    q7?: boolean;
    medicalNotes?: string;
    requiresMedicalReview?: boolean;
  };
  mediaConsent?: boolean;
  termsAccepted?: boolean;
  termsVersion?: string;
  waiverAccepted?: boolean;
  waiverVersion?: string;
  signedName?: string;
  signature_b64?: string;
  deviceType?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  const cleaned = value.replace(/[^\d+]/g, "");
  return cleaned.length >= 9;
}

function isValidDob(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return false;
  if (d > new Date()) return false;
  return true;
}

function parseDataUrlImage(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:image\/(?:jpeg|jpg|png);base64,(.+)$/i);
  if (!match?.[1]) {
    throw new Error("Invalid signature image format");
  }

  return Buffer.from(match[1], "base64");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true; memberId: string } | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = (req.body || {}) as SubmitBody;

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim();
    const email_normalized = email.toLowerCase();
    const phone = String(body.phone || "").trim();
    const dateOfBirth = String(body.dateOfBirth || "").trim();
    const address = String(body.address || "").trim();
    const emergencyName = String(body.emergencyContact?.name || "").trim();
    const emergencyPhone = String(body.emergencyContact?.phone || "").trim();

    const q1 = Boolean(body.parq?.q1);
    const q2 = Boolean(body.parq?.q2);
    const q3 = Boolean(body.parq?.q3);
    const q4 = Boolean(body.parq?.q4);
    const q5 = Boolean(body.parq?.q5);
    const q6 = Boolean(body.parq?.q6);
    const q7 = Boolean(body.parq?.q7);

    const medicalNotes = String(body.parq?.medicalNotes || "").trim();
    const requiresMedicalReview =
      Boolean(body.parq?.requiresMedicalReview) ||
      [q1, q2, q3, q4, q5, q6, q7].some(Boolean);

    const mediaConsent = Boolean(body.mediaConsent);
    const termsAccepted = Boolean(body.termsAccepted);
    const termsVersion = String(body.termsVersion || "").trim();
    const waiverAccepted = Boolean(body.waiverAccepted);
    const waiverVersion = String(body.waiverVersion || "").trim();

    const signedName = String(body.signedName || "").trim();
    const signature_b64 = String(body.signature_b64 || "").trim();
    const deviceType = String(body.deviceType || "unknown").trim();

    if (!fullName) return res.status(400).json({ error: "Full name is required" });
    if (!email) return res.status(400).json({ error: "Email is required" });
    if (!isValidEmail(email)) return res.status(400).json({ error: "Valid email is required" });
    if (!phone) return res.status(400).json({ error: "Phone number is required" });
    if (!isValidPhone(phone)) return res.status(400).json({ error: "Valid phone number is required" });
    if (!dateOfBirth) return res.status(400).json({ error: "Date of birth is required" });
    if (!isValidDob(dateOfBirth)) return res.status(400).json({ error: "Valid date of birth is required" });

    if (!emergencyName) {
      return res.status(400).json({ error: "Emergency contact name is required" });
    }
    if (!emergencyPhone) {
      return res.status(400).json({ error: "Emergency contact phone is required" });
    }
    if (!isValidPhone(emergencyPhone)) {
      return res.status(400).json({ error: "Valid emergency contact phone is required" });
    }

    if (requiresMedicalReview && !medicalNotes) {
      return res.status(400).json({ error: "Medical notes are required when any PAR-Q answer is yes" });
    }

    if (!termsAccepted) {
      return res.status(400).json({ error: "Membership terms must be accepted" });
    }
    if (termsVersion !== IRON_ACRE_TERMS_VERSION) {
      return res.status(400).json({ error: "Invalid membership terms version" });
    }

    if (!waiverAccepted) {
      return res.status(400).json({ error: "Liability waiver must be accepted" });
    }
    if (waiverVersion !== IRON_ACRE_WAIVER_VERSION) {
      return res.status(400).json({ error: "Invalid liability waiver version" });
    }

    if (!signedName) {
      return res.status(400).json({ error: "Printed name is required" });
    }

    if (!signature_b64) {
      return res.status(400).json({ error: "Signature is required" });
    }

    const memberRef = db.collection("ironAcreMembers").doc();
    const memberId = memberRef.id;

    const signatureBuffer = parseDataUrlImage(signature_b64);

    const bucket = getStorage().bucket();
    const file = bucket.file(`iron-acre/signatures/${memberId}.jpg`);

    await file.save(signatureBuffer, {
      contentType: "image/jpeg",
      resumable: false,
      metadata: {
        cacheControl: "public,max-age=31536000",
      },
    });

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2500",
    });

    const now = Timestamp.now();

    await memberRef.set({
      fullName,
      email,
      email_normalized,
      phone,
      dateOfBirth,
      address: address || null,

      auth_uid: null,
      linkedUserId: null,
      linkStatus: "unlinked",

      emergencyContact: {
        name: emergencyName,
        phone: emergencyPhone,
      },

      parq: {
        q1,
        q2,
        q3,
        q4,
        q5,
        q6,
        q7,
        medicalNotes: medicalNotes || "",
        requiresMedicalReview,
      },

      mediaConsent,

      termsAccepted: true,
      termsVersion: IRON_ACRE_TERMS_VERSION,

      waiverAccepted: true,
      waiverVersion: IRON_ACRE_WAIVER_VERSION,

      signedName,
      signatureUrl: signedUrl,
      signedAt: now,
      deviceType,

      source: "ipad_kiosk",
      status: "active",

      createdAt: now,
      updatedAt: now,
    });

    return res.status(200).json({
      ok: true,
      memberId,
    });
  } catch (err: any) {
    console.error("[iron-acre/register/submit]", err?.message || err);
    return res.status(500).json({ error: "Failed to submit registration" });
  }
}
