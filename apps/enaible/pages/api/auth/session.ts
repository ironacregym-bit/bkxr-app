import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  adminAuth,
  clearTenantCookieHeader,
  isInvalidFirebaseIdToken,
  sendApiError,
  sessionCookieHeader,
} from "@/lib/server-auth";

const requestSchema = z.object({
  idToken: z.string().min(1),
});

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

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A Firebase ID token is required" });
  }

  let sessionCookie: string;
  try {
    await adminAuth.verifyIdToken(parsed.data.idToken, true);
  } catch (error) {
    if (isInvalidFirebaseIdToken(error)) {
      return res.status(401).json({
        error: "The sign-in token is invalid or expired",
      });
    }
    return sendApiError(res, error, "Could not verify the sign-in token");
  }

  try {
    sessionCookie = await adminAuth.createSessionCookie(parsed.data.idToken, {
      expiresIn: 1000 * 60 * 60 * 24 * 5,
    });
  } catch (error) {
    return sendApiError(
      res,
      error,
      "Could not establish a secure session"
    );
  }

  res.setHeader("Set-Cookie", [
    sessionCookieHeader(sessionCookie),
    clearTenantCookieHeader(),
  ]);
  return res.status(204).end();
}
