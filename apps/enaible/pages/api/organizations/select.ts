import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  activeTenantCookieHeader,
  adminDb,
  ApiError,
  requireUser,
  sendApiError,
} from "@/lib/server-auth";
import { tenantRoleSchema } from "@/lib/schemas";

const requestSchema = z.object({
  tenantId: z.string().min(1),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A valid organisation is required" });
  }

  try {
    const user = await requireUser(req, res);
    const memberRef = adminDb
      .collection("tenants")
      .doc(parsed.data.tenantId)
      .collection("members")
      .doc(user.uid);
    const memberSnapshot = await memberRef.get();
    const membership = memberSnapshot.data();
    const role = tenantRoleSchema.safeParse(membership?.role);

    if (
      !memberSnapshot.exists ||
      membership?.userId !== user.uid ||
      membership?.tenantId !== parsed.data.tenantId ||
      !role.success
    ) {
      throw new ApiError(
        403,
        "You are not a member of this organisation"
      );
    }

    res.setHeader(
      "Set-Cookie",
      activeTenantCookieHeader(user.uid, parsed.data.tenantId)
    );
    return res.status(204).end();
  } catch (error) {
    return sendApiError(res, error, "Could not select the organisation");
  }
}
