import type { NextApiRequest, NextApiResponse } from "next";
import {
  clearSessionCookieHeader,
  clearTenantCookieHeader,
} from "@/lib/server-auth";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", [
    clearSessionCookieHeader(),
    clearTenantCookieHeader(),
  ]);
  return res.status(204).end();
}
