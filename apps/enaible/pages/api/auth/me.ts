import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser, sendApiError } from "@/lib/server-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    return res.status(200).json({ user: await requireUser(req) });
  } catch (error) {
    return sendApiError(res, error, "Could not load your account");
  }
}
