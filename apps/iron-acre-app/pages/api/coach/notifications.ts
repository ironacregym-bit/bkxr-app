
// pages/api/coach/notifications.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  // Replace with your real source (e.g., Firestore "coachNotifications" per user).
  const notifications = [
    {
      id: "n1",
      title: "From your coach",
      message: "Great work this week. Let’s set a target for three sessions.",
      href: "/schedule",
      created_at: new Date().toISOString(),
    },
  ];
  return res.status(200).json({ notifications });
}
