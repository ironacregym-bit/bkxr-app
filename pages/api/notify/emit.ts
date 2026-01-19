
// pages/api/notify/emit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { renderTemplateStrings } from "../../../lib/notifications/render";
import { writeUserNotification } from "../../../lib/notifications/store";
import { sendPushIfOptedIn } from "../../../lib/notifications/push";
import { sendEmailIfOptedIn } from "../../../lib/notifications/email";

function onboardingComplete(user: any): boolean {
  const h = Number(user?.height_cm);
  const w = Number(user?.weight_kg);
  return h > 0 && w > 0 && !!user?.DOB && !!user?.sex && !!user?.goal_primary && !!user?.workout_type && !!user?.fighting_style;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]!));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const b = req.body || {};
  const event = String(b.event || "").trim();
  const context = b.context || {};
  const userEmail = String(b.email || session.user.email);
  const force = !!b.force;

  try {
    const userSnap = await firestore.collection("users").doc(userEmail).get();
    const user = userSnap.exists ? userSnap.data() : {};

    const q = await firestore
      .collection("notification_rules")
      .where("event", "==", event)
      .where("enabled", "==", true)
      .get();

    const rules = q.docs.map((d) => d.data()).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
    let emitted = 0;

    for (const r of rules) {
      const cond = r.condition || {};
      if (Object.prototype.hasOwnProperty.call(cond, "onboarding_complete")) {
        if (Boolean(cond.onboarding_complete) !== onboardingComplete(user)) continue;
      }

      const { title, body, url, data } = renderTemplateStrings(
        {
          title_template: r.title_template,
          body_template: r.body_template,
          url_template: r.url_template,
          data_template: r.data_template,
        },
        { ...context, user }
      );
      if (!title || !body) continue;

      const channels = Array.isArray(r.channels) && r.channels.length ? r.channels : ["in_app"];
      const created = await writeUserNotification(userEmail, {
        title,
        message: body,
        href: url,
        channels,
        source_key: r.key,
        source_event: event,
        throttle_seconds: Number(r.throttle_seconds || 0),
        expires_in_hours: Number(r.expires_in_hours || 0),
        force,
        meta: data,
      });
      if (!created) continue;
      emitted++;

      if (channels.includes("push")) await sendPushIfOptedIn(userEmail, { title, body, url });
      if (channels.includes("email")) {
        const subject = title;
        const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
          <h2>${escapeHtml(subject)}</h2>
          <p>${escapeHtml(body)}</p>
          ${url ? `<p><a href="${url}">Open BXKR</a></p>` : ""}
        </div>`;
        await sendEmailIfOptedIn(userEmail, { subject, bodyHtml: html, bodyText: `${subject}\n\n${body}\n${url ?? ""}`.trim() });
      }
    }

    return res.status(200).json({ emitted });
  } catch (e: any) {
    console.error("[notify/emit]", e?.message || e, e?.stack);
    return res.status(500).json({ error: "Failed to emit" });
  }
}
