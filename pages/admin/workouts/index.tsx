// pages/admin/workouts/index.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";

type WorkoutRow = {
  workout_id: string;
  workout_name: string;
  visibility?: "global" | "private";
  focus?: string;
  notes?: string;
  owner_email?: string;
  kind: "gym" | "bxkr" | "unknown";
  created_at?: any;
};

type ListResp = { items: WorkoutRow[] };

type AdminRound = { name: string; order: number; items: any[] };

type AdminWorkout = {
  workout_id: string;
  workout_name: string;
  visibility: "global" | "private";
  owner_email?: string;
  focus?: string;
  notes?: string;
  video_url?: string;
  // GYM (may or may not be inflated by the GET API)
  warmup?: AdminRound | null;
  main?: AdminRound | null;
  finisher?: AdminRound | null;
  // BXKR
  boxing?: { rounds: any[] };
  kettlebell?: { rounds: any[] };
  // Discriminator may be present on doc
  workout_type?: string;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export default function AdminWorkoutsManager() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  // Mount guard (hydration safety)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ----- Local UI state -----
  const [query, setQuery] = useState("");
  const [filterVis, setFilterVis] = useState<"" | "global" | "private">("");
  const [filterKind, setFilterKind] = useState<"" | "gym" | "bxkr">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileEditing, setMobileEditing] = useState(false);
  const [viewerDate, setViewerDate] = useState<string>(formatYMD(new Date()));

  // Build list key
  const listKey = useMemo(() => {
    if (!mounted || status === "loading") return null;
    const isAllowed = !!session && (role === "admin" || role === "gym");
    if (!isAllowed) return null;

    const qs = new URLSearchParams();
    if (query.trim()) qs.set("q", query.trim());
    if (filterVis) qs.set("visibility", filterVis);
    qs.set("limit", "300");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return `/api/workouts/list${suffix}`;
  }, [mounted, status, session, role, query, filterVis]);

  const { data: listData } = useSWR<ListResp>(listKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const items: WorkoutRow[] = Array.isArray(listData?.items) ? listData!.items : [];

  // Client-side kind filter
  const filteredItems = useMemo(() => {
    if (!filterKind) return items;
    return items.filter((w) => w.kind === filterKind);
  }, [items, filterKind]);

  // Selected workout fetch
  const getKey = useMemo(() => {
    if (!mounted || status === "loading" || !selectedId) return null;
    const isAllowed = !!session && (role === "admin" || role === "gym");
    if (!isAllowed) return null;
    return `/api/workouts/admin/${encodeURIComponent(selectedId)}`;
  }, [mounted, status, session, role, selectedId]);

  const { data: selectedData } = useSWR<AdminWorkout>(getKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const selected = selectedData || null;

  // Derive the selected row (from the list) and use its 'kind' primarily
  const selectedRow = useMemo(
    () => (selectedId ? items.find((w) => w.workout_id === selectedId) || null : null),
    [items, selectedId]
  );

  // Prefer the list row kind (which is derived from workout_type by the list API).
  // If not available (e.g., page reloaded and detail fetched before list), fallback to workout_type.
  const selectedKind: "gym" | "bxkr" | "unknown" = useMemo(() => {
    if (selectedRow?.kind === "gym" || selectedRow?.kind === "bxkr") return selectedRow.kind;
    const wt = String((selected as any)?.workout_type || "").toLowerCase();
    if (wt === "gym_custom") return "gym";
    // Default to bxkr when discriminator is missing or different
    return selected ? "bxkr" : "unknown";
  }, [selectedRow, selected]);

  // ----- Render -----
  const isAllowed = !!session && (role === "admin" || role === "gym");

  return (
    <>
      <Head><title>Workouts • Admin</title></Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        {/* Access gates */}
        {(!mounted || status === "loading") && <div className="py-4">Checking access…</div>}

        {mounted && status !== "loading" && !isAllowed && (
          <div className="py-4">
            <h3>Access Denied</h3>
            <p>You do not have permission to view this page.</p>
            <Link href="/more" className="btn btn-outline-secondary">← Back</Link>
          </div>
        )}

        {mounted && status !== "loading" && isAllowed && (
          <>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <Link href="/admin" className="btn btn-outline-secondary">← Admin</Link>
                <h2 className="m-0">Workouts</h2>
              </div>

              {/* Mobile: create buttons */}
              <div className="d-md-none d-flex gap-2">
                <Link href="/admin/workouts/create" className="btn btn-bxkr">
                  <i className="fas fa-plus me-2" /> New BXKR
                </Link>
                <Link href="/admin/workouts/gym-create" className="btn btn-outline-light">
                  New Gym
                </Link>
              </div>
            </div>

            <div className="row gx-3">
              {/* List pane */}
              <div className={`col-12 col-md-4 ${mobileEditing ? "d-none d-md-block" : ""}`}>
                <div className="futuristic-card p-3">
                  <div className="d-flex gap-2 mb-2">
                    <input
                      className="form-control"
                      placeholder="Search name or focus…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className="btn btn-outline-light" onClick={() => setQuery("")}>
                      <i className="fas fa-times" />
                    </button>
                  </div>

                  <div className="d-flex gap-2 mb-2">
                    <select className="form-select" value={filterVis} onChange={(e) => setFilterVis(e.target.value as any)}>
                      <option value="">Visibility: All</option>
                      <option value="global">Global</option>
                      <option value="private">Private</option>
                    </select>
                    <select className="form-select" value={filterKind} onChange={(e) => setFilterKind(e.target.value as any)}>
                      <option value="">Kind: All</option>
                      <option value="bxkr">BXKR</option>
                      <option value="gym">Gym</option>
                    </select>
                    {/* Desktop create buttons */}
                    <div className="d-none d-md-flex gap-2">
                      <Link href="/admin/workouts/create" className="btn btn-bxkr">
                        <i className="fas fa-plus me-2" /> BXKR
                      </Link>
                      <Link href="/admin/workouts/gym-create" className="btn btn-outline-light">
                        Gym
                      </Link>
                    </div>
                  </div>

                  <div style={{ maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
                    {!filteredItems.length ? (
                      <div className="text-muted">No workouts found.</div>
                    ) : (
                      <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
                        {filteredItems.map((w) => {
                          const active = selectedId === w.workout_id;
                          return (
                            <li key={w.workout_id}>
                              <button
                                type="button"
                                onClick={() => { setSelectedId(w.workout_id); setMobileEditing(true); }}
                                className="w-100 text-start"
                                style={{
                                  border: "1px solid rgba(255,255,255,0.12)",
                                  background: active ? "rgba(255,138,42,0.13)" : "rgba(255,255,255,0.04)",
                                  color: "#fff",
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                  marginBottom: 8,
                                }}
                              >
                                <div className="d-flex align-items-center justify-content-between">
                                  <div className="fw-semibold text-truncate">{w.workout_name}</div>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge" style={{ background: ACCENT, color: "#0b0f14" }}>
                                      {w.kind === "gym" ? "Gym" : w.kind === "bxkr" ? "BXKR" : "Unknown"}
                                    </span>
                                    <span className="badge" style={{ border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#fff" }}>
                                      {w.visibility || "global"}
                                    </span>
                                  </div>
                                </div>
                                <div className="small text-dim">
                                  {w.focus || "—"} {w.owner_email ? `• ${w.owner_email}` : ""}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Detail/actions pane */}
              <div className={`col-12 col-md-8 ${mobileEditing ? "" : "d-none d-md-block"}`}>
                <div className="futuristic-card p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="m-0">{selected ? selected.workout_name : "Select a workout"}</h5>
                    <div className="d-md-none">
                      <button className="btn btn-outline-light btn-sm" onClick={() => setMobileEditing(false)}>
                        <i className="fas fa-chevron-left me-2" /> Back to list
                      </button>
                    </div>
                  </div>

                  {!selected && <div className="text-dim">Pick a workout from the list to view actions and details.</div>}

                  {selected && (
                    <>
                      {/* Meta */}
                      <div className="row g-2">
                        <div className="col-6 col-md-3">
                          <div className="text-dim small">Visibility</div>
                          <div className="fw-semibold">{selected.visibility}</div>
                        </div>
                        <div className="col-6 col-md-3">
                          <div className="text-dim small">Owner</div>
                          <div className="fw-semibold">{selected.owner_email || "—"}</div>
                        </div>
                        <div className="col-12 col-md-6">
                          <div className="text-dim small">Focus</div>
                          <div className="fw-semibold">{selected.focus || "—"}</div>
                        </div>
                        {selected.video_url ? (
                          <div className="col-12 mt-1">
                            <a
                              className="btn btn-sm btn-outline-light"
                              href={selected.video_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ borderRadius: 24 }}
                            >
                              Watch Video
                            </a>
                          </div>
                        ) : null}
                      </div>

                      {selected.notes ? (
                        <div className="mt-2">
                          <div className="text-dim small">Notes</div>
                          <div className="small" style={{ opacity: 0.9 }}>{selected.notes}</div>
                        </div>
                      ) : null}

                      {/* Gym viewer date control: show only for Gym */}
                      {selectedKind === "gym" && (
                        <div className="mt-3 d-flex align-items-center gap-2">
                          <label htmlFor="viewer-date" className="small text-dim mb-0">Gym viewer date</label>
                          <input
                            id="viewer-date"
                            type="date"
                            className="form-control form-control-sm"
                            value={viewerDate}
                            onChange={(e) => setViewerDate(e.target.value)}
                            style={{ width: 160, background: "transparent", color: "#fff" }}
                            title="Used to set the Mon–Sun week window in the Gym viewer"
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="d-flex flex-wrap gap-2 mt-3">
                        {/* Open in Viewer */}
                        <Link
                          href={
                            selectedKind === "gym"
                              ? `/gymworkout/${encodeURIComponent(selected.workout_id)}${viewerDate ? `?date=${encodeURIComponent(viewerDate)}` : ""}`
                              : `/workout/${encodeURIComponent(selected.workout_id)}`
                          }
                          className="btn btn-outline-light"
                          style={{ borderRadius: 24 }}
                        >
                          Open in Viewer
                        </Link>

                        {/* Edit in Viewer (shared) */}
                        <Link
                          href={`/admin/viewer/${encodeURIComponent(selected.workout_id)}`}
                          className="btn btn-outline-light"
                          style={{ borderRadius: 24 }}
                        >
                          Edit in Viewer
                        </Link>

                        {/* Edit (Dedicated editors) */}
                        <Link
                          href={
                            selectedKind === "gym"
                              ? `/admin/workouts/gym-edit/${encodeURIComponent(selected.workout_id)}`
                              : `/admin/workouts/bxkr-edit/${encodeURIComponent(selected.workout_id)}`
                          }
                          className="btn"
                          style={{ borderRadius: 24, background: ACCENT, color: "#0b0f14" }}
                        >
                          Edit
                        </Link>
                      </div>

                      {/* Quick outline of shape */}
                      <div className="small text-dim mt-3">
                        Kind:{" "}
                        <span className="text-light">
                          {selectedKind === "gym" ? "GYM" : selectedKind === "bxkr" ? "BXKR" : "Unknown"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}
