import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const url = String(req.query.url || "").trim();

  if (!url) {
    return res.status(400).send("Missing url");
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(404).send("File not found");
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    const fileName =
      url.split("/").pop()?.split("?")[0] ||
      "download";

    const contentType =
      response.headers.get("content-type") ||
      "application/octet-stream";

    res.setHeader(
      "Content-Type",
      contentType
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    res.send(buffer);
  } catch (error) {
    console.error(error);

    res.status(500).send("Download failed");
  }
}
