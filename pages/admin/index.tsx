// pages/admin/index.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import BottomNav from "../../components/BottomNav";
import { useCallback, useMemo, useState } from "react";

type AdminTile = {
  title: string;
  subtitle: string;
  icon: string;
  link: string;
  tone: "green" | "blue" | "red" | "amber" | "muted";
};

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
        } catch {
          // ignore unsubscribe errors
        }
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

  const toneStyles: Record<
    AdminTile["tone"],
    {
      border: string;
      iconBg: string;
      iconColor: string;
      glow: string;
      badgeBg: string;
      badgeColor: string;
    }
  > = useMemo(
    () => ({
      green: {
        border: "rgba(24, 255, 154, 0.18)",
        iconBg: "rgba(24, 255, 154, 0.12)",
        iconColor: "#18ff9a",
        glow: "0 0 16px rgba(24,255,154,0.16)",
        badgeBg: "rgba(24,255,154,0.10)",
        badgeColor: "#18ff9a",
      },
      blue: {
        border: "rgba(89, 184, 255, 0.18)",
        iconBg: "rgba(89, 184, 255, 0.12)",
        iconColor: "#59b8ff",
        glow: "0 0 16px rgba(89,184,255,0.16)",
        badgeBg: "rgba(89,184,255,0.10)",
        badgeColor: "#9bd5ff",
      },
      red: {
        border: "rgba(255, 95, 115, 0.18)",
        iconBg: "rgba(255, 95, 115, 0.12)",
        iconColor: "#ff8fa0",
        glow: "0 0 16px rgba(255,95,115,0.16)",
        badgeBg: "rgba(255,95,115,0.10)",
        badgeColor: "#ffb7c1",
      },
      amber: {
        border: "rgba(255, 184, 77, 0.18)",
        iconBg: "rgba(255, 184, 77, 0.12)",
        iconColor: "#ffb84d",
        glow: "0 0 16px rgba(255,184,77,0.16)",
        badgeBg: "rgba(255,184,77,0.10)",
        badgeColor: "#ffd089",
      },
      muted: {
        border: "rgba(255, 255, 255, 0.10)",
        iconBg: "rgba(255, 255, 255, 0.08)",
        iconColor: "#c9d3df",
        glow: "none",
        badgeBg: "rgba(255,255,255,0.08)",
        badgeColor: "#dbe6f2",
      },
    }),
    []
  );

  const tileGroups: { title: string; subtitle: string; items: AdminTile[] }[] = [
    {
      title: "Sessions and timetable",
      subtitle: "Create one-off sessions, recurring timetable rows and manage the live calendar.",
      items: [
        {
          title: "Sessions",
          subtitle: "View, edit, cancel or delete sessions",
          icon: "fas fa-calendar-alt",
          link: "/admin/sessions",
          tone: "blue",
        },
        {
          title: "Create session",
          subtitle: "Add a single new class session",
          icon: "fas fa-calendar-plus",
          link: "/admin/classes/create-session",
          tone: "green",
        },
        {
          title: "Recurring timetable",
          subtitle: "Build the weekly recurring timetable",
          icon: "fas fa-repeat",
          link: "/admin/sessions/recurring",
          tone: "blue",
        },
      ],
    },
    {
      title: "Coaching and programming",
      subtitle: "Manage workouts, exercises, combos and member programmes.",
      items: [
        {
          title: "Workouts",
          subtitle: "Browse and manage workouts",
          icon: "fas fa-list-ul",
          link: "/admin/workouts",
          tone: "green",
        },
        {
          title: "Create workout",
          subtitle: "Build a BXKR workout",
          icon: "fas fa-dumbbell",
          link: "/admin/workouts/create",
          tone: "green",
        },
        {
          title: "Create gym workout",
          subtitle: "Build a gym-focused workout",
          icon: "fas fa-weight-hanging",
          link: "/admin/workouts/gym-create",
          tone: "amber",
        },
        {
          title: "Create exercise",
          subtitle: "Add a new exercise to the library",
          icon: "fas fa-plus-circle",
          link: "/admin/exercises/create",
          tone: "green",
        },
        {
          title: "Boxing combos",
          subtitle: "Manage boxing combinations",
          icon: "fas fa-hand-rock",
          link: "/admin/boxing-combos",
          tone: "blue",
        },
        {
          title: "Programs",
          subtitle: "Create and manage member programmes",
          icon: "fas fa-clipboard-check",
          link: "/admin/programs/create",
          tone: "green",
        },
      ],
    },
    {
      title: "Members and communication",
      subtitle: "Stay on top of members, notifications and share links.",
      items: [
        {
          title: "Members",
          subtitle: "Manage member accounts and access",
          icon: "fas fa-address-book",
          link: "/admin/members",
          tone: "blue",
        },
        {
          title: "Notifications",
          subtitle: "Send and manage in-app notifications",
          icon: "fas fa-bell",
          link: "/admin/notifications",
          tone: "red",
        },
        {
          title: "WhatsApp links",
          subtitle: "Generate and share class links",
          icon: "fab fa-whatsapp",
          link: "/admin/share",
          tone: "green",
        },
      ],
    },
    {
      title: "Nutrition",
      subtitle: "Add recipes, plans and supplements.",
      items: [
        {
          title: "Recipes",
          subtitle: "Manage recipe content",
          icon: "fas fa-utensils",
          link: "/admin/recipes",
          tone: "red",
        },
        {
          title: "Meal plans",
          subtitle: "Manage meal plans",
          icon: "fas fa-clipboard-list",
          link: "/admin/mealplans",
          tone: "amber",
        },
        {
          title: "Supplements",
          subtitle: "Manage supplements library",
          icon: "fas fa-pills",
          link: "/admin/supplements",
          tone: "amber",
        },
      ],
    },
  ];

  if (status === "loading") {
    return (
      <>
        <Head>
          <title>Admin dashboard • Iron Acre</title>
        </Head>

        <main
          className="container py-3 iron-acre-home ia-home-main"
          style={{ paddingBottom: 90, color: "#fff" }}
        >
          <section className="ia-tile ia-tile-pad">
            <div className="ia-page-title">Checking access…</div>
          </section>
        </main>

        <BottomNav />
      </>
    );
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <>
        <Head>
          <title>Admin dashboard • Iron Acre</title>
        </Head>

        <main
          className="container py-3 iron-acre-home ia-home-main"
          style={{ paddingBottom: 90, color: "#fff" }}
        >
          <section className="ia-tile ia-tile-pad">
            <div className="ia-page-title">Access denied</div>
            <div className="ia-page-subtitle">You do not have permission to view this page.</div>
          </section>
        </main>

        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Admin dashboard • Iron Acre</title>
      </Head>

      <main
        className="container py-3 iron-acre-home ia-home-main"
        style={{ paddingBottom: 90, color: "#fff" }}
      >
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div style={{ minWidth: 0 }}>
              <div className="ia-kicker">
                <i className="fas fa-shield-alt" />
                admin
              </div>
              <div className="ia-page-title">Admin dashboard</div>
              <div className="ia-page-subtitle">
                Manage sessions, timetable, workouts, members and communications from one place.
              </div>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div style={{ minWidth: 0 }}>
              <div className="ia-kicker">
                <i className="fas fa-bell" />
                notifications
              </div>
              <div className="ia-card-title-compact">Push notification health</div>
              <div className="text-dim small mt-1">
                If you’ve changed VAPID keys or moved device/browser, re-enable push notifications here.
              </div>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <Link href="/admin/notifications" className="ia-btn ia-btn-outline">
                Open notifications
              </Link>

              <button
                type="button"
                className="ia-btn"
                onClick={handleReenableNotifications}
                disabled={busy}
              >
                {busy ? "Working…" : "Re-enable notifications"}
              </button>
            </div>
          </div>

          {msg ? (
            <div className="mt-3">
              {msg.includes("✅") ? (
                <div className="ia-inline-note-success">{msg}</div>
              ) : (
                <div className="ia-inline-note-error">{msg}</div>
              )}
            </div>
          ) : null}
        </section>

        {tileGroups.map((group) => (
          <section key={group.title} className="ia-tile ia-tile-pad mb-3">
            <div className="mb-2">
              <div className="ia-kicker">
                <i className="fas fa-layer-group" />
                section
              </div>
              <div className="ia-card-title-compact">{group.title}</div>
              <div className="text-dim small mt-1">{group.subtitle}</div>
            </div>

            <div className="row g-2">
              {group.items.map((tile) => {
                const tone = toneStyles[tile.tone];

                return (
                  <div key={tile.link} className="col-12 col-md-6 col-xl-4">
                    <Link href={tile.link} className="ia-link" style={{ display: "block" }}>
                      <div
                        className="ia-task-card"
                        style={{
                          minHeight: 94,
                          borderColor: tone.border,
                          background:
                            "linear-gradient(180deg, rgba(18,24,33,0.95) 0%, rgba(12,17,24,0.95) 100%)",
                        }}
                      >
                        <div className="ia-task-card__main">
                          <div className="ia-task-card__titleRow">
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 10,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: tone.iconBg,
                                color: tone.iconColor,
                                boxShadow: tone.glow,
                                flex: "0 0 auto",
                              }}
                            >
                              <i className={tile.icon} />
                            </div>

                            <div
                              className="ia-task-card__meta"
                              style={{
                                whiteSpace: "nowrap",
                                background: tone.badgeBg,
                                color: tone.badgeColor,
                                borderColor: tone.border,
                              }}
                            >
                              open
                            </div>
                          </div>

                          <div className="ia-task-card__title mt-2">{tile.title}</div>
                          <div className="ia-task-card__subtitle">{tile.subtitle}</div>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <BottomNav />
    </>
  );
}
