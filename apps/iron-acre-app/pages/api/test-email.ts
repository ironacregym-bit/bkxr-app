import type { NextApiRequest, NextApiResponse } from "next";
import { sendMail } from "../../lib/email";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await sendMail({
      to: "YOUR_EMAIL@gmail.com",
      subject: "Iron Acre Email Test",
      html: `
        <h1>Iron Acre Email Test</h1>

        <p>If you're reading this then email sending is working.</p>

        <p>💪 See you in the yard.</p>
      `,
      text: "Iron Acre Email Test",
    });

    return res.status(200).json({
      success: true,
    });
  } catch (err: any) {
    console.error(err);

    return res.status(500).json({
      success: false,
      error: err?.message || "Unknown error",
    });
  }
}
