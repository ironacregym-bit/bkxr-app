// pages/admin/founders.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (u: string) =>
  fetch(u).then(async (r) => {
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json?.error || `Request failed: ${r.status}`);
    return json;
  });

type FounderRow = {
  id: string;
  source?: string;
  name: string;
  email: string;
  phone?: string | null;
  interested_classes: string[];
  preferred_times: string[];
  sessions_per_week: string;
  biggest_goal: string;
  referral_name?: string | null;
  referral_contact?: string | null;
  consent_to_contact: boolean;
  created_at?: string | null;
};

type FoundersAdminResponse = {
  items: FounderRow[];
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminFoundersPage() {
  const { data, error, isLoading } = useSWR<FoundersAdminResponse>(
    "/api/admin/founders",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const items = data?.items || [];

  return (
    <>
      <Head>
        <title>Founders Leads • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3 iron-acre-home" style={{ paddingBottom: 32 }}>
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-kicker">
            <i className="fas fa-users" />
            founders leads
          </div>

          <div className="d-flex justify-content-between align-items-start gap-2 mt-2">
            <div>
              <div className="ia-page-title">Founders submissions</div>
              <div className="ia-page-subtitle">
                View responses from the public founders page and referral interest.
              </div>
            </div>

            <div className="d-flex gap-2">
              <Link href="/founders">
                Open public page
              </Link>
              <Link href="/iron-acre">
                Dashboard
              </Link>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2">
            <div>
              <div className="ia-card-title-compact">Lead list</div>
              <div className="text-dim small mt-1">
                {isLoading ? "Loading submissions..." : `${items.length} submission${items.length === 1 ? "" : "s"}`}
              </div>
            </div>
          </div>

          {error ? (
            <div className="ia-inline-note-error mt-3">
              {(error as Error)?.message || "Failed to load founders submissions"}
            </div>
          ) : null}

          {!error && isLoading ? (
            <div className="text-dim small mt-3">Loading...</div>
          ) : null}

          {!error && !isLoading && items.length === 0 ? (
            <div className="text-dim small mt-3">No founders submissions yet.</div>
          ) : null}

          {!error && !isLoading && items.length > 0 ? (
            <div className="d-grid gap-3 mt-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderRadius: 16,
                    padding: 14,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                    <div>
                      <div className="ia-card-title-compact">{item.name || "Unnamed lead"}</div>
                      <div className="text-dim small mt-1">
                        {item.email || "—"}
                        {item.phone ? ` • ${item.phone}` : ""}
                      </div>
                    </div>

                    <div className="text-end">
                      <div className="text-dim small">{fmtDate(item.created_at)}</div>
                      {item.consent_to_contact ? (
                        <div className="mt-1">
                          <span className="ia-badge ia-badge-neon">Contact ok</span>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <span className="ia-badge">No consent</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="row g-2 mt-2">
                    <div className="col-12 col-md-6">
                      <div className="text-dim small">Interested classes</div>
                      <div className="mt-1">
                        {item.interested_classes?.length
                          ? item.interested_classes.join(", ")
                          : "—"}
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <div className="text-dim small">Preferred times</div>
                      <div className="mt-1">
                        {item.preferred_times?.length
                          ? item.preferred_times.join(", ")
                          : "—"}
                      </div>
                    </div>

                    <div className="col-6 col-md-3">
                      <div className="text-dim small">Sessions/week</div>
                      <div className="mt-1">{item.sessions_per_week || "—"}</div>
                    </div>

                    <div className="col-6 col-md-3">
                      <div className="text-dim small">Main goal</div>
                      <div className="mt-1">{item.biggest_goal || "—"}</div>
                    </div>

                    <div className="col-12 col-md-6">
                      <div className="text-dim small">Referral</div>
                      <div className="mt-1">
                        {item.referral_name || item.referral_contact
                          ? `${item.referral_name || "Unnamed"}${
                              item.referral_contact ? ` • ${item.referral_contact}` : ""
                            }`
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="text-dim small mt-3">ID: {item.id}</div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
