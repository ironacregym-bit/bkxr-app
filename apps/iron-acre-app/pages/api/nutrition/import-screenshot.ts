import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { GoogleGenAI } from "@google/genai";

import { authOptions } from "../auth/[...nextauth]";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const session = await getServerSession(
    req,
    res,
    authOptions
  );

  if (!session?.user?.email) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  try {
    const { imageBase64 } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({
        error: "Missing image",
      });
    }

    const contents = [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64,
        },
      },
      `
    Analyse this nutrition tracking screenshot.
    
    The screenshot may come from:
    
    - MyFitnessPal
    - Nutracheck
    - Cronometer
    - Lose It
    - Samsung Health
    - Apple Health
    
    Return VALID JSON ONLY.
    
    {
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "foods": [
        {
          "name": string,
          "calories": number,
          "protein": number,
          "carbs": number,
          "fat": number
        }
      ]
    }
    `,
    ];
    
    let response;
    
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
      });
    } catch (err) {
      console.warn(
        "[nutrition/import-screenshot] 2.5 flash failed, trying 2.0 flash"
      );
    
      response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents,
      });
    }

    const text = String(response.text || "")
      .replace(/```json/gi, "")
      .replace(/```/gi, "")
      .trim();

    const parsed = JSON.parse(text);

    return res.status(200).json(parsed);
  } catch (err: any) {
    console.error(
      "[nutrition/import-screenshot]",
      err?.message || err
    );

    return res.status(500).json({
      error: "Failed to analyse screenshot",
    });
  }
}
