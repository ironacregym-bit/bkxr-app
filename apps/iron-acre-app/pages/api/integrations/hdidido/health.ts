
// pages/api/integrations/hdidido/health.ts
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Health check for the HDIDIDO automation integration.
 * - Confirms required env vars exist (no secrets revealed)
 * - Returns server UTC time (helps compare with local/BST)
 * - Optionally validates CRON auth by checking the header value format (not equality)
 * - Optionally proxies a "dry" runner readiness hint (no DB access or booking)
 *
 * This is read-only, has no side effects, and does not touch Firestore.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Required envs for your runner
  const appBaseUrl = process.env.APP_BASE_URL || "";
  const cronSecret = process.env.CRON_SECRET || "";
  const wsEndpoint = process.env.BROWSER_WS_ENDPOINT || "";

  // Mask any token in the WS endpoint for safe logging/printing
  const maskedWs = wsEndpoint
    ? wsEndpoint.replace(/(token=)[^&]+/i, "$1***")
    : "";

  // If the caller sends an Authorization header, we can confirm format only (not equality)
  const authHeader = req.headers.authorization || "";
  const hasBearerFormat = /^Bearer\s+.+/.test(authHeader);

  // Optional: surface the exact server runtime for clarity
  const serverTimeUtc = new Date().toISOString();

  return res.status(200).json({
    ok: true,
    serverTimeUtc,
    // Env presence (booleans only)
    hasAppBaseUrl: Boolean(appBaseUrl),
    hasCronSecret: Boolean(cronSecret),
    hasBrowserWs: Boolean(wsEndpoint),

    // Masked values to help spot typos without leaking secrets
    masked: {
      appBaseUrl: appBaseUrl || null,
      browserWsEndpoint: maskedWs || null
    },

    // If you called this endpoint with Authorization, we confirm only the format
    receivedAuthHeaderBearerFormat: hasBearerFormat
  });
}
