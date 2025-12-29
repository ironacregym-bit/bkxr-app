
// components/TasksBanner.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function TasksBanner() {
  const { data, error, isLoading } = useSWR("/api/onboarding/status", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items: { id: string; key: string; title: string; description?: string; targetPath: string }[] =
    Array.isArray(data?.outstanding) ? data!.outstanding : [];

  if (error) return null;
  if (isLoading) return <div className="bxkr-card p-3 mb-2">Loading tasks…</div>;
  if (items.length === 0) return null;

  return (
    <div className="bxkr-card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0" style={{ fontWeight: 700 }}>Quick start tasks</h6>
        <div className="small text-dim">{items.length} outstanding</div>
      </div>

      <div className="bxkr-carousel" style={{ gap: 12 }}>
        {items.map((t) => (
          <div key={t.id} className="bxkr-slide" style={{ minWidth: "85%" }}>
            <Link href={t.targetPath} className="text-decoration-none">
              <div className="bxkr-card p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">{t.title}</div>
                    {t.description && <div className="small text-dim mt-1">{t.description}</div>}
                  </div>
                  <i className="fas fa-chevron-right" aria-hidden="true" />
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>    
  );
}
