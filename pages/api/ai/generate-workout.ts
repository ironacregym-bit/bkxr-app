import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.status(200).json({
    workout:
      "AI endpoint connected successfully.\n\nNext step is wiring Gemini into this route.",
  });
}
