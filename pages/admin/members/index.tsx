
// /pages/admin/members/index.tsx
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";

const ACCENT = "#FF8A2A";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

type MemberItem = {
  email: string;
  name?: string | null;
  membership_status?: string | null;
  subscription_status?: string | null;
  updated_at?: string | null;
};

type ListResp = {
  items: MemberItem[];
  nextCursor?: string | null;
};

export default function AdminMembersIndex() {
  const mounted = useMounted();
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const isAllowed = !!session && (role === "admin" || role === "gym");

  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const swrKey = mounted && isAllowed ? `/api/admin/members/list?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}` : null;
  const { data, error, isValidating } = useSWR<ListResp>(swrKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items = Array.isArray(data?.items) ? data!.items : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => {
      const hay = `${m.email || ""} ${m.name || ""} ${m.membership_status || ""} ${m.subscription_status || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  return (
    <>
      <Head>
        <title>Members • Admin • BXKR</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">← Back</Link>
          <h2 className="mb-0">Members</h2>
          <div style={{ width: 80 }} />
        </div>

        {!mounted || status === "loading" ? (
          <div className="container py-4">Checking access…</div>
        ) : !isAllowed ? (
          <div className="container py-4">
            <h3>Access Denied</h3>
            <p>You do not have permission to view this page.</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Search by name, email, or status"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search members"
              />
            </div>

            {/* List */}
            <div className="d-grid gap-2">
              {filtered.map((m) => {
                const href = `/admin/members/${encodeURIComponent(m.email)}`;
                return (
                  <Link key={m.email} href={href} className="text-decoration-none">
                    <div
                      className="p-3"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <div className="fw-semibold" style={{ color: "#fff" }}>
                            {m.name || m.email}
                          </div>
                          <div className="small text-muted">
                            {m.email}
                          </div>
                          <div className="small text-muted mt-1">
                            Membership: <span style={{ color: ACCENT }}>{m.membership_status || "—"}</span> · Sub:{" "}
                            <span style={{ color: ACCENT }}>{m.subscription_status || "—"}</span>
                          </div>
                        </div>
                        <div className="text-end small text-muted">
                          <i className="fa fa-chevron-right" aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-center text-muted py-4">No members found.</div>
              )}
            </div>

            {/* Pagination */}
            <div className="d-grid mt-3">
              {data?.nextCursor ? (
                <button
                  className="bxkr-btn"
                  onClick={() => setCursor(data.nextCursor || null)}
                  disabled={isValidating}
                >
                  {isValidating ? "Loading…" : "Load more"}
                </button>
              ) : (
                <button className="btn btn-outline-secondary" disabled>
                  End of list
                </button>
              )}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}
