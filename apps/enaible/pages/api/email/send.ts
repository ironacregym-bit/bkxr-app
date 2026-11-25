import type { NextApiRequest, NextApiResponse } from "next";
import { approvedEmailRequestSchema } from "@pt/email-engine";
import {
  ApiError,
  sendApiError,
} from "@/lib/server-auth";
import {
  requireEmailApiCredential,
  sendApprovedTemplateEmail,
} from "@/lib/email-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (
    typeof req.headers["content-type"] !== "string" ||
    !req.headers["content-type"].startsWith("application/json")
  ) {
    return res
      .status(415)
      .json({ error: "Content-Type must be application/json" });
  }

  const parsed = approvedEmailRequestSchema.safeParse({
    ...req.body,
    idempotencyKey: req.headers["idempotency-key"],
  });
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Invalid email request",
    });
  }

  try {
    const credential = await requireEmailApiCredential(req);
    const result = await sendApprovedTemplateEmail(credential, parsed.data);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return sendApiError(res, error);
    }
    return sendApiError(res, error, "Could not send approved email");
  }
}
