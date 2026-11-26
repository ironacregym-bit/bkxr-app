import type { NextApiRequest, NextApiResponse } from "next";
import {
  requireTenantContext,
  sendApiError,
} from "@/lib/server-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const context = await requireTenantContext(req, res);
    return res.status(200).json({
      organization: {
        tenantId: context.tenantId,
        name: context.tenantName,
        role: context.role,
      },
    });
  } catch (error) {
    return sendApiError(
      res,
      error,
      "Could not load the active organisation"
    );
  }
}
