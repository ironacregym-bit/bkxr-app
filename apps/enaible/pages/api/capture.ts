import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import {
  createCapture,
} from "../../../../packages/capture-engine/src/createCapture";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const result =
      await createCapture(
        req.body
      );

    return res.status(200).json(
      result
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
}
