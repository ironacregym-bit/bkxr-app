
// pages/nutrition-home.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";

type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
type ShoppingListMeta = { id: string; name: string; people: number; created_at: string; updated_at: string };
type RecipeSummary = { id: string; title: string; meal_type?: string; image?: string|null; per_serving?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number } };

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

export default function NutritionHome() {
  const { status, data: session } = useSession();
  const authed = status === "authenticated";
  const email = session?.user?.email ?? "";

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Today's nutrition logs → snapshot
  const { data: entriesResp } = useSWR<{ entries: any[] }>(
    authed && email ? `/api/nutrition/logs` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );

  const totals: Totals = useMemo(() => {
    const entries = Array.isArray(entriesResp?.entries) ? entriesResp!.entries : [];
    return entries.reduce(
      (acc, it) => {
        acc.calories += Number(it.calories || 0);
        acc.protein_g += Number(it.protein || 0);
        acc.carbs_g += Number(it.carbs || 0);
        acc.fat_g += Number(it.fat || 0);
        return acc;
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } as Totals
    );
  }, [entriesResp]);

  // Shopping lists
  const { data: listsResp, mutate: mutateLists } = useSWR<{ lists: ShoppingListMeta[] }>(
    authed ? `/api/shopping/lists` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const lists = useMemo(() => listsResp?.lists || [], [listsResp]);

  // Recipes favourites (for tile)
  const { data: favResp, mutate: mutateFavs } = useSWR<{ favourites: string[]; recipes?: RecipeSummary[] }>(
    authed ? `/api/recipes/favourites?limit=8` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const favRecipes = useMemo(() => favResp?.recipes || [], [favResp]);

  // Create list controls (no “number of people” shown in UI per your note)
  const [listName, setListName] = useState("");

  async function createList() {
    const name = listName.trim() || "My List";
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to create list");
      setListName("");
      await mutateLists();
      setMsg("List created");
    } catch (e: any) {
      setMsg(e?.message || "Failed to create list");
    } finally {
      setBusy(false);
    }
  }

  async function deleteList(id: string) {
    if (!confirm("Delete this list and its items/meals?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/lists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to delete list");
      await mutateLists();
      setMsg("List deleted");
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete list");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Nutrition • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main
        className="container py-3"
        style={{ paddingBottom: 80, color: "#fff", borderRadius: 12, minHeight: "100vh" }}
      >
        {/* Header */}
        <div className="mb-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
            <div>
              <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>Nutrition</h1>
              <small style={{ opacity: 0.75 }}>Fuel the work</small>
            </div>
            <Link
              href="/"
              className="btn btn-bxkr-outline btn-sm"
              style={{ borderRadius: 24, display: "inline-flex", alignItems: "center", gap: 6 }}
              aria-label="Back to home"
            >
              <i className="fas fa-arrow-left" /> <span>Back</span>
            </Link>
          </div>
          {msg && <div className="alert alert-info mt-2 mb-0">{msg}</div>}
        </div>

        {/* Tiles */}
        <section className="row gx-3">
          {/* Today snapshot — whole tile clickable + button */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-0" style={{ height: "100%", overflow: "hidden" }}>
              <Link
                href="/nutrition"
                className="d-block p-3 text-decoration-none"
                style={{ color: "inherit" }}
                aria-label="Open Log Nutrition"
              >
                <h6 className="mb-2" style={{ fontWeight: 700 }}>Today</h6>
                <div className="d-flex align-items-center" style={{ gap: 10, fontWeight: 600 }}>
                  <span>Cal {Math.round(totals.calories)}</span>
                  <span className="text-dim">•</span>
                  <span>P {Math.round(totals.protein_g)}g</span>
                  <span className="text-dim">•</span>
                  <span>C {Math.round(totals.carbs_g)}g</span>
                  <span className="text-dim">•</span>
                  <span>F {Math.round(totals.fat_g)}g</span>
                </div>
                <div className="text-dim mt-1" style={{ fontSize: 12 }}>
                  Snapshot of what you’ve logged today.
                </div>
              </Link>
              <div className="px-3 pb-3">
                <Link
                  href="/nutrition"
                  className="btn btn-sm"
                  style={{
                    borderRadius: 24,
                    color: "#fff",
                    background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                    boxShadow: `0 0 14px ${ACCENT}66`,
                    border: "none",
                    paddingInline: 14,
                  }}
                >
                  Log Nutrition
                </Link>
              </div>
            </div>
          </div>

          {/* Shopping lists overview */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3" style={{ height: "100%" }}>
              <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
                <h6 className="m-0" style={{ fontWeight: 700 }}>Shopping Lists</h6>
                <Link href="/recipes" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
                  Browse Recipes
                </Link>
              </div>

              {/* Create list */}
              <div className="d-flex flex-wrap align-items-end mb-3" style={{ gap: 8 }}>
                <input
                  className="form-control"
                  placeholder="List name"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  style={{ minWidth: 180, flex: 1 }}
                />
                <button
                  className="btn btn-sm"
                  onClick={createList}
                  disabled={busy}
                  style={{
                    borderRadius: 24,
                    color: "#fff",
                    background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                    boxShadow: `0 0 14px ${ACCENT}66`,
                    border: "none",
                    paddingInline: 14,
                  }}
                >
                  Create
                </button>
              </div>

              {/* Lists */}
              {!lists.length ? (
                <div className="text-dim">No lists yet. Create one to get started.</div>
              ) : (
                <ul className="list-unstyled m-0">
                  {lists.map((L) => (
                    <li
                      key={L.id}
                      className="d-flex align-items-center justify-content-between"
                      style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <div>
                        <div className="fw-semibold">{L.name}</div>
                      </div>
                      <div className="d-flex" style={{ gap: 8 }}>
                        <Link href={`/shopping/${L.id}`} className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
                          Open
                        </Link>
                        <button className="btn btn-bxkr-outline btn-sm" onClick={() => deleteList(L.id)} style={{ borderRadius: 24 }}>
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Favourite Recipes tile */}
        <section className="row gx-3 mt-1">
          <div className="col-12 mb-3">
            <div className="futuristic-card p-3">
              <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
                <h6 className="m-0" style={{ fontWeight: 700 }}>Favourite Recipes</h6>
                <Link href="/recipes" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
                  Browse Recipes
                </Link>
              </div>

              {!favRecipes.length ? (
                <div className="text-dim">No favourites yet. Browse recipes and tap the heart to save.</div>
              ) : (
                <div className="row g-2">
                  {favRecipes.map((r) => (
                    <div key={r.id} className="col-6 col-sm-4 col-md-3">
                      <Link
                        href={`/recipes/${r.id}`}
                        className="bxkr-card p-2 text-decoration-none"
                        style={{ display: "block", color: "inherit", borderRadius: 12 }}
                      >
                        {r.image ? (
                          <img
                            src={r.image}
                            alt={r.title}
                            style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10 }}
                          />
                        ) : (
                          <div
                            className="text-dim"
                            style={{
                              height: 110,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "1px solid var(--bxkr-card-border)",
                              borderRadius: 10,
                            }}
                          >
                            No image
                          </div>
                        )}
                        <div className="mt-2">
                          <div className="fw-semibold" style={{ lineHeight: 1.2 }}>{r.title}</div>
                          <div className="text-dim" style={{ fontSize: 12 }}>
                            {Math.round(r.per_serving?.calories || 0)} kcal • P{Math.round(r.per_serving?.protein_g || 0)} • C{Math.round(r.per_serving?.carbs_g || 0)} • F{Math.round(r.per_serving?.fat_g || 0)}
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
