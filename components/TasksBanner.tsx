
// components/TasksBanner.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type TaskItem = {
  id: string;
  key: string;             // e.g., "metrics", "job_goal", "workout_type", "fighting_style"
  title: string;
  description?: string;
  targetPath: string;      // e.g., "/onboarding"
};

export default function TasksBanner() {
  const { data: session } = useSession();
  const email = session?.user?.email || null;

  // Outstanding tasks from server
  const { data, error, isLoading } = useSWR("/api/onboarding/status", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  // Profile used to determine if tasks are already done
  const swrProfileKey = email ? `/api/profile?email=${encodeURIComponent(email)}` : null;
  const { data: profile } = useSWR(swrProfileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items: TaskItem[] = Array.isArray(data?.outstanding)
    ? (data!.outstanding as TaskItem[])
    : [];

  if (error) return null;
  if (isLoading) return <div className="bxkr-card p-3 mb-2">Loading tasks…</div>;
  if (!items.length) return null;

  // ----- Completion guards (client-side) -----
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

  const filtered = items.filter((t) => {
    // Specific task keys
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

  if (!filtered.length) return null;

  return (
    <div className="mb-3" role="region" aria-label="Quick start tasks">
      {filtered.map((t) => (
        <TaskPill
          key={t.id}
          title={t.title}
          message={t.description || "Tap to continue"}
          href={t.targetPath}
          // Same feel as .btn-bxkr (orange gradient + pill)
          background="linear-gradient(135deg, var(--bxkr-accent), #ff7f32)"
          accentColor="#0b0f14" // dark text works on orange gradient; we’ll compute accessible text colour
        />
      ))}
    </div>
  );
}

/** Weekly Snapshot / Coach-style pill banner for a single task */
function TaskPill({
  title,
  message,
  href,
  background = "linear-gradient(135deg, var(--bxkr-accent), #ff7f32)",
  accentColor,
}: {
  title: string;
  message: string;
  href: string;
  background?: string;
  /** Optional override; otherwise we derive contrasting text colour from gradient end colour. */
  accentColor?: string;
}) {
  // Derive a readable text colour against the orange gradient (use the end colour here for heuristic)
  const gradientEnd = "#ff7f32";
  const textColour = accentColor || getReadableTextColor(gradientEnd);

  return (
    <Link
      href={href}
      className="text-decoration-none"
      aria-label={`${title}: ${message}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background,
        borderRadius: 50,
        padding: "12px 16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        color: textColour,
        marginBottom: 12,
      }}
    >
      {/* Left icon circle (consistent with weekly snapshot / coach style) */}
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
            color: "#ffffff",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, opacity: 0.95, color: "#ffffff" }}>{message}</div>
      </div>

      {/* Right chevron */}
      <i
        className="fas fa-chevron-right"
        aria-hidden="true"
        style={{ marginLeft: 12, color: "#ffffff" }}
      />
    </Link>
  );
}

// Simple luminance-based contrast heuristic for text colour choice
function getReadableTextColor(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#0e0e0e";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 160 ? "#0e0e0e" : "#ffffff";
}
