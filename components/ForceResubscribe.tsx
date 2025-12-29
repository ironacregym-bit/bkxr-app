
// components/ForceResubscribe.tsx
"use client";
export default function ForceResubscribe() {
  async function run() {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) { try { await existing.unsubscribe(); } catch {} }
    const vapidPub = "<PASTE YOUR PUBLIC KEY HERE>";
    const toUint8 = (b64: string) => {
      const pad = "=".repeat((4 - (b64.length % 4)) % 4);
      const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
      const raw = atob(base64);
      return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
    };
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(vapidPub) });
    await fetch("/api/notifications/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: JSON.parse(JSON.stringify(sub)) }) });
    localStorage.setItem("bxkr_vapid_pub", vapidPub);
    alert("Re‑subscribed ✅");
  }
  return <button className="btn btn-sm btn-outline-light" onClick={run}>Re‑enable notifications</button>;
}
