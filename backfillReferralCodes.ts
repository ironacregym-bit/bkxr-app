
import firestore from "../lib/firestoreClient";
import { randomBytes } from "crypto";

function shortCode(len = 6) {
  return randomBytes(6).toString("base64url").slice(0, len);
}

async function generateUniqueCode() {
  for (let i = 0; i < 5; i++) {
    const code = shortCode(6 + i);
    const snap = await firestore
      .collection("users")
      .where("referral_code", "==", code)
      .limit(1)
      .get();
    if (snap.empty) return code;
  }
  return shortCode(8);
}

async function main() {
  console.log("🔍 Scanning users for missing referral codes...");

  const usersCol = firestore.collection("users");
  const snap = await usersCol.get();

  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const email = doc.id;

    if (!data.referral_code) {
      const code = await generateUniqueCode();

      await doc.ref.set(
        {
          referral_code: code,
          referral_totals: {
            total_signups: 0,
            active_paid: 0,
            commission_rate: 0.05,
            total_earned: 0,
          },
        },
        { merge: true }
      );

      console.log(`✔ Added referral_code to ${email} → ${code}`);
      updated++;
    }
  }

  console.log(`\n🎉 Finished! Updated referral codes for ${updated} users.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
