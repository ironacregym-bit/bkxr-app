"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import BottomNav from "../../components/BottomNav";
import { useCallback, useState } from "react";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleReenableNotifications = useCallback(async () => {
    setBusy(true);
    setMsg(null);

    try {
      if (!("serviceWorker" in navigator)) {
        setMsg("Service Worker not supported in this browser.");
        return;
      }
      if (!("Notification" in window) || !("PushManager" in window)) {
        setMsg("Push notifications are not supported on this device/browser.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;

      let perm = Notification.permission as NotificationPermission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Notifications permission not granted.");
        return;
      }

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch {}
      }

      const vapidPub = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
      if (!vapidPub) {
        setMsg("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
        return;
      }

      const toUint8 = (b64: string) => {
        const pad = "=".repeat((4 - (b64.length % 4)) % 4);
        const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(base64);
        return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
      };

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8(vapidPub),
      });

      const subObj = JSON.parse(JSON.stringify(sub));
      const resp = await fetch("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subObj }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to register subscription");
      }

      localStorage.setItem("bxkr_vapid_pub", vapidPub);
      setMsg("Notifications re-enabled ✅");
    } catch (e: any) {
      setMsg(e?.message || "Failed to re-enable notifications.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (status === "loading") {
    return <div className="container py-4">Checking access…</div>;
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const tiles = [
    // 🔧 Workouts admin library (NEW)
    { title: "Workouts", icon: "fas fa-list-ul", link: "/admin/workouts", color: "primary" },

    { title: "Create Workout (BXKR)", icon: "fas fa-dumbbell", link: "/admin/workouts/create", color: "primary" },
    { title: "Create Exercise", icon: "fas fa-plus-circle", link: "/admin/exercises/create", color: "success" },
    { title: "Create Gym Workout", icon: "fas fa-weight-hanging", link: "/admin/workouts/gym-create", color: "warning" },
    { title: "Create Session", icon: "fas fa-calendar-plus", link: "/admin/sessions/create", color: "info" },
    { title: "Generate WhatsApp Link", icon: "fab fa-whatsapp", link: "/admin/share", color: "success" },
    { title: "Notifications", icon: "fas fa-bell", link: "/admin/notifications", color: "danger" },
    { title: "Members", icon: "fas fa-address-book", link: "/admin/members", color: "primary" },
    { title: "Recipes", icon: "fas fa-utensils", link: "/admin/recipes", color: "danger" },
    // 🆕 Meal Plans admin
    { title: "Meal Plans", icon: "fas fa-clipboard-list", link: "/admin/mealplans", color: "warning" },
    // 🆕 Supplements admin
    { title: "Supplements", icon: "fas fa-pills", link: "/admin/supplements", color: "warning" },
  ];

  return (
    <>
      <Head>
        <title>Admin Dashboard - BXKR</title>
      </Head>

      <main className="container py-3" style={{ paddingBottom: "70px" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 className="mb-0 text-center w-100">Admin Dashboard</h2>
        </div>

        {/* Re-enable notifications card */}
        <div className="card p-3 mb-3" style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16 }}>
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
            <div>
              <div className="fw-semibold">Notifications</div>
              <div className="small text-muted">
                If you’ve changed VAPID keys or moved devices, re-enable push notifications here.
              </div>
            </div>

            <div className="d-flex gap-2 align-items-center">
              <Link href="/admin/notifications" className="btn-bxkr-outline">
                Open Notifications Admin
              </Link>

              <button
                type="button"
                className="btn btn-sm"
                onClick={handleReenableNotifications}
                disabled={busy}
                style={{
                  borderRadius: 24,
                  color: "#0b0f14",
                  background: "linear-gradient(135deg, #FF8A2A, #ff7f32)",
                  boxShadow: "0 0 12px rgba(255,138,42,0.6)",
                  border: "none",
                  padding: "8px 16px",
                  fontWeight: 600,
                }}
              >
                {busy ? "Working…" : "Re-enable notifications"}
              </button>
            </div>
          </div>

          {msg && (
            <div className={`mt-2 alert ${msg.includes("✅") ? "alert-success" : "alert-info"}`} role="alert">
              {msg}
            </div>
          )}
        </div>

        <div className="row g-3">
          {tiles.map((tile, idx) => (
            <div key={idx} className="col-6 col-md-4">
              <Link href={tile.link} className="text-decoration-none">
                <div className={`card text-center p-3 shadow-sm border-${tile.color}`}>
                  <div className={`text-${tile.color} mb-2`}>
                    <i className={`${tile.icon} fa-2x`} />
                  </div>
                  <h6 className="fw-bold">{tile.title}</h6>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </>
  );
}
