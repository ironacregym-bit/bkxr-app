
"use client";

import useSWR from "swr";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Supplement = {
  id: string;
  name: string;
  quantity?: string | number | null; // e.g., "90 capsules" or 90
  link?: string | null;              // product URL
  brand?: string | null;
  notes?: string | null;
  image_url?: string | null;
  // Any extra fields in your collection will be ignored by this UI
};

export default function SupplementsPage() {
  const { data, error, isLoading } = useSWR("/api/supplements/list", fetcher);
  const items: Supplement[] = data?.supplements ?? [];

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff" }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0" style={{ fontWeight: 700 }}>Supplements</h2>
          {/* optional future filter/search controls can go here */}
        </div>

        <div className="futuristic-card p-3 mb-3">
          <p className="mb-0 text-dim">
            Hand‑picked supplements I recommend. Tap a card to open the product page in a new tab.
          </p>
        </div>

        {isLoading && <div className="futuristic-card p-3 mb-3">Loading supplements…</div>}
        {error && <div className="futuristic-card p-3 mb-3 text-danger">Failed to load supplements.</div>}

        {items.length === 0 && !isLoading && !error && (
          <div className="futuristic-card p-3 mb-3 text-dim">No supplements found.</div>
        )}

        {/* List */}
        <div className="row g-3">
          {items.map((s) => (
            <div className="col-12" key={s.id}>
              <a
                className="text-decoration-none"
                href={s.link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${s.name} product page`}
              >
                <div className="futuristic-card p-3 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    {/* Image (optional) */}
                    {s.image_url ? (
                      <img
                        src={s.image_url}
                        alt={s.name}
                        style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", border: "1px solid rgba(255,255,255,0.12)" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                        }}
                      >
                        <i className="fas fa-pills" aria-hidden="true" />
                      </div>
                    )}

                    <div>
                      <div className="fw-bold">{s.name}{s.brand ? ` — ${s.brand}` : ""}</div>
                      <div className="small text-dim">
                        {s.quantity != null ? `Qty: ${String(s.quantity)}` : "Qty: —"}
                        {s.notes ? ` • ${s.notes}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span className="bxkr-chip">{s.link ? "View" : "No link"}</span>
                    <i className="fas fa-external-link-alt" aria-hidden="true" />
                  </div>
                </div>
              </a>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </>
  );
}
