
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getFirestore } from "@/lib/firestoreClient";
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
  answers: ParqAnswers;
  photos_consent: boolean;
  consent_confirmed: boolean;
  signed_name: string;
  signature_b64?: string;
  provided_email?: string;
  session_id?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const body = req.body as Body;

    // Basic validation (keep minimal)
    if (!body || !body.answers || !body.signed_name || typeof body.consent_confirmed !== "boolean") {
      res.status(400).send("Invalid payload");
      return;
    }

    // Ensure all answers are present and valid
    const keys: (keyof ParqAnswers)[] = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"];
    for (const k of keys) {
      const v = (body.answers as any)[k];
      if (v !== "yes" && v !== "no") {
        res.status(400).send("All PAR‑Q questions must be answered");
        return;
      }
    }

    const signedName = String(body.signed_name || "").trim();
    if (!signedName) {
      res.status(400).send("Signed name required");
      return;
    }

    const nowIso = new Date().toISOString();
    const client = getFirestore();

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const ua = (req.headers["user-agent"] as string) || "";
    const ipHash = ip ? crypto.createHash("sha256").update(ip).digest("hex") : undefined;

    // Optionally trim large signatures (simple guardrail ~1.25MB)
    let signature_b64 = body.signature_b64;
    if (signature_b64 && signature_b64.length > 1_250_000) {
      // Too large; store none to avoid exceeding Firestore limits
      signature_b64 = undefined;
    }

    const doc = {
      answers: body.answers,
      photos_consent: !!body.photos_consent,
      consent_confirmed: !!body.consent_confirmed,
      signed_name: signedName,
      signature_b64,
      user_email: session?.user?.email || null,
      provided_email: body.provided_email || null,
      session_id: body.session_id || null,
      created_at: nowIso,
      user_agent: ua || null,
      created_by_ip_hash: ipHash || null,
    };

    await client.collection("parq_responses").add(doc);

    res.status(200).json({ ok: true });
  } catch {
    // Avoid leaking details
    res.status(500).send("Server error");
  }
}
