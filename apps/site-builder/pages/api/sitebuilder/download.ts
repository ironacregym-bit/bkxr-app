import type { NextApiRequest, NextApiResponse } from "next";

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, "_");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const url = String(req.query.url || "").trim();

  const filename =
    safeFileName(
      String(req.query.filename || "").trim()
    ) || "download";

  if (!url) {
    return res.status(400).send("Missing url");
  }

  try {
    console.log("DOWNLOAD URL:", url);

    const response = await fetch(url);

    console.log("STATUS:", response.status);

    if (!response.ok) {
      const text = await response.text();

      console.error("ERROR RESPONSE:");
      console.error(text);

      return res.status(response.status).send(text);
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    const contentType =
      response.headers.get("content-type") ||
      "application/octet-stream";

    res.setHeader("Content-Type", contentType);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    return res.send(buffer);
  } catch (e: any) {
    console.error(e);

    return res
      .status(500)
      .send(e?.message || "Download failed");
  }
}
