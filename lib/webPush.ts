
// lib/webPush.ts
import * as webpush from "web-push";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;

// Identify your app/team (any valid mailto/URL)
webpush.setVapidDetails("mailto:ironacregym@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);

// ✅ Named export only
export { webpush };
