// pages/api/iron-acre/register/submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { Timestamp } from "@google-cloud/firestore";
import { authOptions } from "../../auth/[...nextauth]";
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

type Body = {
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

  const now = new Date();
  if (d > now) return false;

  return true;
}

function isValidImageDataUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;

  return (
    s.startsWith("data:image/jpeg;base64,") ||
    s.startsWith("data:image/jpg;base64,") ||
    s.startsWith("data:image/png;base64,") ||
    s.startsWith("data:image/webp;base64,")
  );
}

const MAX_SIG_LEN = 1_500_000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true; memberId: string } | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const body = (req.body || {}) as Body;

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const dateOfBirth = String(body.dateOfBirth || "").trim();
    const address = String(body.address || "").trim();

    const emergencyName = String(body.emergencyContact?.name || "").trim();
    const emergencyPhone = String(body.emergencyContact?.phone || "").trim();

    const signedName = String(body.signedName || "").trim();
    const signature_b64 = body.signature_b64;

    const medicalNotes = String(body.parq?.medicalNotes || "").trim();

    const q1 = !!body.parq?.q1;
    const q2 = !!body.parq?.q2;
    const q3 = !!body.parq?.q3;
    const q4 = !!body.parq?.q4;
    const q5 = !!body.parq?.q5;
    const q6 = !!body.parq?.q6;
    const q7 = !!body.parq?.q7;

    const requiresMedicalReview =
      !!body.parq?.requiresMedicalReview || [q1, q2, q3, q4, q5, q6, q7].some(Boolean);

    const mediaConsent = !!body.mediaConsent;
    const termsAccepted = body.termsAccepted === true;
    const waiverAccepted = body.waiverAccepted === true;
    const termsVersion = String(body.termsVersion || "").trim();
    const waiverVersion = String(body.waiverVersion || "").trim();
    const deviceType = String(body.deviceType || "unknown").trim() || "unknown";

    if (!fullName) {
      return res.status(400).json({ error: "Full name is required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    if (!dateOfBirth) {
      return res.status(400).json({ error: "Date of birth is required" });
    }

    if (!isValidDob(dateOfBirth)) {
      return res.status(400).json({ error: "Invalid date of birth" });
    }

    if (!emergencyName) {
      return res.status(400).json({ error: "Emergency contact name required" });
    }

    if (!emergencyPhone) {
      return res.status(400).json({ error: "Emergency contact phone required" });
    }

    if (!isValidPhone(emergencyPhone)) {
      return res.status(400).json({ error: "Invalid emergency contact phone number" });
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

    if (!signature_b64 || !isValidImageDataUrl(signature_b64)) {
      return res.status(400).json({ error: "Valid signature is required" });
    }

    if (signature_b64.length > MAX_SIG_LEN) {
      return res.status(400).json({ error: "Signature image is too large" });
    }

    if (requiresMedicalReview && !medicalNotes) {
      return res.status(400).json({
        error: "Medical notes are required when PAR-Q answers indicate review is needed",
      });
    }

    const memberRef = db.collection("ironAcreMembers").doc();
    const memberId = memberRef.id;
    const now = Timestamp.now();

    const sessionEmail =
      String((session?.user as any)?.email || "").trim().toLowerCase() || null;
    const emailNormalized = email.toLowerCase();

    await memberRef.set({
      fullName,
      email,
      email_normalized: emailNormalized,
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
      signature_b64,
      signedAt: now,
      deviceType,

      source: "ipad_kiosk",
      status: "active",

      createdAt: now,
      updatedAt: now,

      created_by_email: sessionEmail,
      submitted_by_authenticated_user: !!sessionEmail,
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
