import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const cronKey =
    req.headers["x-cron-key"];

  if (
    cronKey !== process.env.CRON_KEY
  ) {
    return res.status(401).json({
      error: "Unauthorised",
    });
  }

  return res.status(200).json({
    success: true,
    message:
      "Workflow processor online",
  });
}
