
// components/TasksBanner.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// Exact gradient requested
const GRADIENT = "linear-gradient(135deg, #ff7f32, #ff9a3a)";
// Default coach avatar (replace with your image in /public)
const COACH_AVATAR_SRC = "/coach.jpg";

type TaskItem = {
  id: string;
  key: string;             // "metrics" | "job_goal" | "workout_type" | "fighting_style" | ...
  title: string;
  description?: string;
  targetPath: string;      // e.g., "/onboarding"
};

type CoachNotification = {
  id: string;
  title: string;           // e.g., "Coach update"
  message: string;         // body
  href?: string;           // optional deep link
  created_at?: string;
};

export default function TasksBanner() {
  const { data: session } = useSession();
  const email = session?.user?.email || null;

  // Outstanding tasks from server
  const { data: statusResp, error: statusErr, isLoading: statusLoading } = useSWR(
    "/api/onboarding/status",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  // Profile used to determine if tasks are already done
  const swrProfileKey = email ? `/api/profile?email=${encodeURIComponent(email)}` : null;
  const { data: profile } = useSWR(swrProfileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  // Optional coach notifications
  const { data: coachResp } = useSWR("/api/coach/notifications", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items: TaskItem[] = Array.isArray(statusResp?.outstanding)
    ? (statusResp!.outstanding as TaskItem[])
    : [];

  const notifications: CoachNotification[] = Array.isArray(coachResp?.notifications)
    ? (coachResp!.notifications as CoachNotification[])
    : [];

  if (statusErr) return null;
  if (statusLoading) return <div className="bxkr-card p-3 mb-2">Loading…</div>;

  // ----- Completion guards (client-side only; we'll also add server-side when you paste the API) -----
  const metricsComplete = (() => {
    if (!profile) return false;
    const h = Number(profile.height_cm);
    const w = Number(profile.weight_kg);
    const hasDOB = !!profile.DOB;
    const hasSex = !!profile.sex;
    return h > 0 && w > 0 && hasDOB && hasSex;
  })();

  const jobGoalComplete = !!profile?.goal_primary;
  const workoutTypeComplete = !!profile?.workout_type;
  const fightingStyleComplete = !!profile?.fighting_style;

  const onboardingAllComplete =
    metricsComplete && jobGoalComplete && workoutTypeComplete && fightingStyleComplete;

  const filteredTasks = items.filter((t) => {
    if (t.key === "metrics") return !metricsComplete;
    if (t.key === "job_goal") return !jobGoalComplete;
    if (t.key === "workout_type") return !workoutTypeComplete;
    if (t.key === "fighting_style") return !fightingStyleComplete;

    // Fallback: any onboarding link should vanish if all onboarding steps are done
    if (t.targetPath?.toLowerCase().includes("/onboarding")) {
      return !onboardingAllComplete;
    }
    return true;
  });

  // If nothing to show, return null
  const nothing =
    (!notifications || notifications.length === 0) &&
    (!filteredTasks || filteredTasks.length === 0);
  if (nothing) return null;

  return (
    <div className="mb-3" role="region" aria-label="Coach notifications and quick tasks">
      {/* Coach notifications first */}
      {notifications?.map((n) => (
        <CoachPill
          key={n.id}
          title={n.title || "From your coach"}
          message={n.message}
          href={n.href}
          avatarSrc={COACH_AVATAR_SRC}
        />
      ))}

      {/* Outstanding tasks rendered as pill banners (Weekly Snapshot style) */}
      {filteredTasks.map((t) => (
        <TaskPill
          key={t.id}
          title={t.title}
          message={t.description || "Tap to continue"}
          href={t.targetPath}
        />
      ))}
    </div>
  );
}

/** Pill banner with coach avatar (matches weekly snapshot feel in orange gradient) */
function CoachPill({
  title,
  message,
  href,
  avatarSrc = COACH_AVATAR_SRC,
}: {
  title: string;
  message: string;
  href?: string;
  avatarSrc?: string;
}) {
  const Content = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: GRADIENT,
        borderRadius: 50,
        padding: "12px 16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        color: "#fff",
        marginBottom: 12,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.4)",
          marginRight: 12,
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        {/* Use next/image if you prefer; keeping simple for drop-in */}
        <img src={avatarSrc} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {/* Text */}
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, opacity: 0.95 }}>{message}</div>
      </div>

      {/* Chevron */}
      <i className="fas fa-chevron-right" aria-hidden="true" style={{ marginLeft: 12, color: "#fff" }} />
    </div>
  );

  return href ? (
    <Link href={href} className="text-decoration-none" aria-label={`${title}: ${message}`}>
      {Content}
    </Link>
  ) : (
    Content
  );
}

/** Pill banner for a task (matches weekly snapshot style and gradient) */
function TaskPill({
  title,
  message,
  href,
}: {
  title: string;
  message: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="text-decoration-none"
      aria-label={`${title}: ${message}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: GRADIENT,
        borderRadius: 50,
        padding: "12px 16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        color: "#fff",
        marginBottom: 12,
      }}
    >
      {/* Left icon circle */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.15)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginRight: 12,
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <i className="fas fa-bolt" style={{ fontSize: 18, color: "#ffffff" }} />
      </div>

      {/* Text */}
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, opacity: 0.95 }}>{message}</div>
      </div>

      {/* Chevron */}
      <i className="fas fa-chevron-right" aria-hidden="true" style={{ marginLeft: 12, color: "#fff" }} />
    </Link>
   );
}
