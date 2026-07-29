import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const url = String(req.query.url || "");

  console.log("DOWNLOAD URL:", url);

  try {
    const response = await fetch(url);

    console.log("STATUS:", response.status);
    console.log(
      "CONTENT TYPE:",
      response.headers.get("content-type")
    );

    if (!response.ok) {
      const text = await response.text();

      console.error("ERROR RESPONSE:");
      console.error(text);

      return res
        .status(response.status)
        .send(text);
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") ||
        "application/octet-stream"
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="download"'
    );

    return res.send(buffer);
  } catch (e: any) {
    console.error(e);

    return res
      .status(500)
      .send(e?.message || "Download failed");
  }
}
