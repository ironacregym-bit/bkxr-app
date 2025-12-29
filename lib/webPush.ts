
// lib/webPush.ts
import * as webpushLib from "web-push";
const webpush = webpushLib; // alias for clarity

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;

webpush.setVapidDetailswebpush.setVapidDetails("mailto:support@bxkr.app", VAPID_PUBLIC, VAPID_PRIVATE);

// both exports
export { webpush };
