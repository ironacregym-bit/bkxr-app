
// /pages/api/parq/submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import crypto from "crypto";

type Answer = "yes" | "no";
type ParqAnswers = {
  q1: Answer;
  q2: Answer;
  q3: Answer;
  q4: Answer;
  q5: Answer;
  q6: Answer;
  q7: Answer;
};

type Body = {
  answers?: ParqAnswers;
  photos_consent?: boolean;
  consent_confirmed?: boolean;
  signed_name?: string;
  signature_b64?: string;
  provided_email?: string;
  session_id?: string;
};

const COLLECTION = "parq_responses";

// Basic server-side validation for image data URLs to avoid oversized docs
function isValidImageDataUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  return (
    s.startsWith("data:image/jpeg") ||
    s.startsWith("data:image/png") ||
    s.startsWith("data:image/webp")
  );
}
// Firestore doc hard limit ~1MiB; keep signature conservative
const MAX_SIG_LEN = 900_000; // ~900 KB (client already compresses)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const body = (req.body || {}) as Body;

    // ---- Validate required fields
    if (!body.answers) {
      return res.status(400).json({ error: "Missing answers" });
    }
    const keys: (keyof ParqAnswers)[] = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"];
    for (const k of keys) {
      const v = (body.answers as any)[k];
      if (v !== "yes" && v !== "no") {
        return res.status(400).json({ error: "All PAR‑Q questions must be answered" });
      }
    }

    if (body.consent_confirmed !== true) {
      return res.status(400).json({ error: "Consent confirmation is required" });
    }

    const signedName = (body.signed_name || "").trim();
    if (!signedName) {
      return res.status(400).json({ error: "Signed name required" });
    }

    // Optional email sanity
    const providedEmail = (body.provided_email || "").trim();
    if (providedEmail) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(providedEmail);
      if (!emailOk) {
        return res.status(400).json({ error: "Invalid email format" });
      }
    }

    // Signature size guard
    let signature_b64: string | undefined = undefined;
    if (body.signature_b64 && isValidImageDataUrl(body.signature_b64)) {
      signature_b64 = body.signature_b64.length <= MAX_SIG_LEN ? body.signature_b64 : undefined;
    }

    // Minimal context
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";
    const ua = (req.headers["user-agent"] as string) || "";
    const ipHash = ip ? crypto.createHash("sha256").update(ip).digest("hex") : null;

    const now = new Date();

    // Build doc
    const doc = {
      answers: body.answers,
      photos_consent: !!body.photos_consent,
      consent_confirmed: true,
      signed_name: signedName,
      signature_b64: signature_b64 || null,
      user_email: (session?.user as any)?.email || null,
      provided_email: providedEmail || null,
      session_id: body.session_id || null,
      created_at: now,
      user_agent: ua || null,
      created_by_ip_hash: ipHash,
    };

    await firestore.collection(COLLECTION).add(doc);

    return res.status(200).json({ ok: true });
  } catch (err) {
    // Avoid leaking details
    return res.status(500).json({ error: "Server error" });
  }
}
