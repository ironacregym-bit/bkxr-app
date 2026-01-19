
// pages/api/admin/notifications/daily-habits-nudge.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
const CRON_KEY=process.env.CRON_KEY;
const BASE=process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
function todayIso(d=new Date()){return d.toISOString().slice(0,10);}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET","POST"].includes(req.method||"")){ res.setHeader("Allow","GET, POST"); return res.status(405).json({error:"Method not allowed"}); }
  if (CRON_KEY && req.headers["x-cron-key"] !== CRON_KEY) return res.status(403).json({ error: "Forbidden" });

  const usersSnap=await firestore.collection("users").select().get();
  const today=todayIso(); let targeted=0, emitted=0;

  for (const d of usersSnap.docs){
    const email=d.id; if(!email) continue;
    const u=d.data()||{};
    const status=String(u.subscription_status||"none");
    const isGym=u.membership_status==="gym_member" && !!u.membership_verified;
    if (status!=="active" && !isGym) continue; // or remove this to include everyone

    const habitsDone = String(u.habits_completed_on||"") === today;
    const nutritionLogged = String(u.nutrition_logged_on||"") === today;
    if (habitsDone && nutritionLogged) continue;

    targeted++;
    await fetch(`${BASE}/api/notify/emit`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ event:"daily_habits_nudge", email, context:{ date: today, habitsDone, nutritionLogged }, force:false })
    }).catch(()=>null);
    emitted++;
  }
  return res.status(200).json({ ok:true, targeted, emitted });
}
