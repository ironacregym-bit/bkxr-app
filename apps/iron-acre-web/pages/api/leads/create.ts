import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return res.status(200).json({
    GOOGLE_PROJECT_ID:
      process.env.GOOGLE_PROJECT_ID,

    HAS_CLIENT_EMAIL:
      !!process.env.GOOGLE_CLIENT_EMAIL,

    HAS_PRIVATE_KEY:
      !!process.env.GOOGLE_PRIVATE_KEY,

    PRIVATE_KEY_START:
      process.env.GOOGLE_PRIVATE_KEY?.substring(
        0,
        50
      ),
  });
}
