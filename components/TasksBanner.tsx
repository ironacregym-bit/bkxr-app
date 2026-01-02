
// components/TasksBanner.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type TaskItem = {
  id: string;
  key: string;
  title: string;
  description?: string;
  targetPath: string;
};

export default function TasksBanner() {
  const { data: session } = useSession();
  const email = session?.user?.email || null;

  // Outstanding onboarding tasks from server
  const { data, error, isLoading } = useSWR("/api/onboarding/status", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  // We fetch the user's profile so we can hide the "Metrics" task once completed.
  const swrProfileKey = email ? `/api/profile?email=${encodeURIComponent(email)}` : null;
  const { data: profileResp } = useSWR(swrProfileKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    // If you want very fresh state whenever tasks refresh, you could add a slight revalidate if needed.
  });

  const items: TaskItem[] = Array.isArray(data?.outstanding) ? (data!.outstanding as TaskItem[]) : [];

  // Helper: determine whether metrics are complete (height, weight, DOB, sex present)
  const isMetricsComplete = (p: any) => {
    if (!p) return false;
    const hasHeight = Number(p.height_cm) > 0;
    const hasWeight = Number(p.weight_kg) > 0;
    const hasDOB = !!p.DOB;
    const hasSex = !!p.sex;
    return hasHeight && hasWeight && hasDOB && hasSex;
  };

  // Client-side guard: hide the "metrics" task if metrics are done.
  const filteredItems = items.filter((t) => {
    if (t.key === "metrics") {
      return !isMetricsComplete(profileResp);
    }
    return true;
  });

  if (error) return null;
  if (isLoading) return <div className="bxkr-card p-3 mb-2">Loading tasks…</div>;
  if (filteredItems.length === 0) return null;

  return (
    <div className="bxkr-card p-0 mb-3" style={{ overflow: "hidden" }}>
      {/* Gradient header bar (same feel as btn-bxkr) */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--bxkr-accent), #ff7f32)",
          padding: "10px 16px",
        }}
      >
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="m-0" style={{ fontWeight: 700, color: "#0b0f14" }}>Quick start tasks</h6>
          <div className="small" style={{ color: "#0b0f14" }}>{filteredItems.length} outstanding</div>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="bxkr-carousel" style={{ gap: 12 }}>
          {filteredItems.map((t) => (
            <div key={t.id} className="bxkr-slide" style={{ minWidth: "85%" }}>
              <Link href={t.targetPath} className="text-decoration-none">
                <div className="bxkr-card p-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-semibold">{t.title}</div>
                      {t.description && <div className="small text-dim mt-1">{t.description}</div>}
                    </div>
                    <i
                      className="fas fa-chevron-right"
                      aria-hidden="true"
                      style={{ color: "var(--bxkr-accent)" }}
                    />
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
