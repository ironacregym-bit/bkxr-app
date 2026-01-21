
// pages/shopping/[id].tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

type Item = { id: string; name: string; qty?: number | null; unit?: string | null; done?: boolean };
type ListMeta = { id: string; name: string; people: number; created_at: string; updated_at: string };
type ListRecipesRow = { id: string; recipe_id: string; title?: string; people?: number; added_at: string };
type RecipeOption = { id: string; title: string; meal_type?: string; image?: string | null };

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

export default function ShoppingListDetailPage() {
  const router = useRouter();
  const listId = typeof router.query.id === "string" ? router.query.id : "";

  const { status } = useSession();
  const authed = status === "authenticated";

  // Lists meta (to read list name)
  const { data: listsResp, mutate: mutateListMeta } = useSWR<{ lists: ListMeta[] }>(
    authed ? "/api/shopping/lists" : null,
    fetcher
  );
  const listMeta = useMemo(
    () => (listsResp?.lists || []).find((x) => x.id === listId) || null,
    [listsResp, listId]
  );

  // Items tied to this list
  const { data: itemsResp, mutate: mutateItems } = useSWR<{ items: Item[] }>(
    authed && listId ? `/api/shopping/list?list_id=${encodeURIComponent(listId)}` : null,
    fetcher
  );
  const items = itemsResp?.items || [];

  // Meals attached to this list
  const { data: mealsResp, mutate: mutateMeals } = useSWR<{ recipes: ListRecipesRow[] }>(
    authed && listId ? `/api/shopping/list-recipes?list_id=${encodeURIComponent(listId)}` : null,
    fetcher
  );
  const meals = mealsResp?.recipes || [];

  // ----- Meta form (name only) -----
  const [name, setName] = useState<string>(listMeta?.name || "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sync name when meta loads/changes
  useMemo(() => {
    if (listMeta) setName(listMeta.name);
  }, [listMeta?.id]);

  async function saveMeta() {
    if (!listId) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/lists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: listId, name: name.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to update list");
      await mutateListMeta();
      setMsg("List updated");
    } catch (e: any) {
      setMsg(e?.message || "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  // ----- Add Food form -----
  const [foodName, setFoodName] = useState("");
  const [foodQty, setFoodQty] = useState("");
  const [foodUnit, setFoodUnit] = useState("");

  function numberOrNull(s: string): number | null {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function addFood() {
    if (!listId) return;
    const n = foodName.trim();
    if (!n) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addFoods",
          list_id: listId,
          foods: [{ name: n, qty: numberOrNull(foodQty), unit: foodUnit.trim() || null }],
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to add food");
      setFoodName("");
      setFoodQty("");
      setFoodUnit("");
      await mutateItems();
      setMsg("Added");
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  // ----- Add Recipe via searchable picker -----
  const [recipeSearch, setRecipeSearch] = useState("");
  const { data: recipesResp } = useSWR<{ recipes: RecipeOption[] }>(
    authed ? `/api/recipes/list?q=${encodeURIComponent(recipeSearch)}&limit=50` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const recipeOptions = useMemo(() => recipesResp?.recipes || [], [recipesResp]);

  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [recipePeople, setRecipePeople] = useState("1");

  async function addRecipe() {
    if (!listId) return;
    const rid = selectedRecipeId.trim();
    if (!rid) return;
    const ppl = Math.max(1, Number(recipePeople) || 1);
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addRecipe",
          list_id: listId,
          recipe_id: rid,
          people: ppl,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to add recipe");
      setSelectedRecipeId("");
      setRecipePeople("1");
      await Promise.all([mutateItems(), mutateMeals()]);
      setMsg("Recipe ingredients added");
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Shopping List • BXKR</title>
      </Head>
      <main className="container py-3" style={{ paddingBottom: 80, minHeight: "100vh" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h1 className="h5 m-0">{listMeta?.name || "Shopping List"}</h1>
          <Link href="/shopping" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
            <i className="fas fa-arrow-left" /> Back
          </Link>
        </div>

        {msg && <div className="alert alert-info">{msg}</div>}

        {/* Meta (name only) */}
        <div className="futuristic-card p-3 mb-3">
          <div className="row g-2">
            <div className="col-12 col-md-8 d-flex" style={{ gap: 8 }}>
              <input
                className="form-control"
                placeholder="List name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="btn btn-bxkr-outline"
                style={{ borderRadius: 24 }}
                onClick={saveMeta}
                disabled={busy}
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Adders */}
        <div className="futuristic-card p-3 mb-3">
          <h6 className="mb-2" style={{ fontWeight: 700 }}>
            Add to List
          </h6>

          {/* Add Food */}
          <div className="d-flex flex-wrap align-items-end mb-3" style={{ gap: 8 }}>
            <input
              className="form-control"
              placeholder="Food name"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              style={{ minWidth: 180, flex: 1 }}
            />
            <input
              className="form-control"
              placeholder="Qty"
              value={foodQty}
              onChange={(e) => setFoodQty(e.target.value)}
              style={{ width: 100 }}
            />
            <input
              className="form-control"
              placeholder="Unit"
              value={foodUnit}
              onChange={(e) => setFoodUnit(e.target.value)}
              style={{ width: 120 }}
            />
            <button
              className="btn btn-sm"
              onClick={addFood}
              disabled={busy || !foodName.trim()}
              style={{
                borderRadius: 24,
                color: "#fff",
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                boxShadow: `0 0 14px ${ACCENT}66`,
                border: "none",
                paddingInline: 14,
              }}
            >
              Add Food
            </button>
          </div>

          {/* Add Recipe (search + dropdown) */}
          <div className="d-flex flex-wrap align-items-end" style={{ gap: 8 }}>
            <input
              className="form-control"
              placeholder="Search recipe…"
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              style={{ minWidth: 200, flex: 1 }}
            />
            <select
              className="form-select"
              value={selectedRecipeId}
              onChange={(e) => setSelectedRecipeId(e.target.value)}
              style={{ minWidth: 220 }}
              aria-label="Select recipe"
            >
              <option value="">Select a recipe…</option>
              {recipeOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
            <input
              className="form-control"
              type="number"
              min={1}
              placeholder="People"
              value={recipePeople}
              onChange={(e) => setRecipePeople(e.target.value)}
              style={{ width: 120 }}
            />
            <button
              className="btn btn-bxkr-outline btn-sm"
              onClick={addRecipe}
              disabled={busy || !selectedRecipeId}
              style={{ borderRadius: 24 }}
            >
              Add Recipe
            </button>
            <Link href="/recipes" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
              Browse Recipes
            </Link>
          </div>
        </div>

        {/* Items */}
        <div className="futuristic-card p-3 mb-3">
          <h6 className="mb-2" style={{ fontWeight: 700 }}>
            Items
          </h6>
          {!items.length ? (
            <div className="text-dim">No items yet.</div>
          ) : (
            <ul className="list-unstyled m-0">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="d-flex align-items-center justify-content-between"
                  style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div>
                    <div className="fw-semibold">{it.name}</div>
                    <div className="text-dim" style={{ fontSize: 12 }}>
                      {it.qty ?? "-"} {it.unit ?? ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Meals attached */}
        <div className="futuristic-card p-3">
          <h6 className="mb-2" style={{ fontWeight: 700 }}>
            Meals on this List
          </h6>
          {!meals.length ? (
            <div className="text-dim">No meals attached yet.</div>
          ) : (
            <ul className="list-unstyled m-0">
              {meals.map((m) => (
                <li
                  key={m.id}
                  className="d-flex align-items-center justify-content-between"
                  style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div>
                    <div className="fw-semibold">{m.title || m.recipe_id}</div>
                    {/* Keeping people here is useful for context; tell me if you want this hidden too */}
                    <div className="text-dim" style={{ fontSize: 12 }}>{m.people || 1} people</div>
                  </div>
                  <Link
                    href={`/recipes/${m.recipe_id}`}
                    className="btn btn-bxkr-outline btn-sm"
                    style={{ borderRadius: 24 }}
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
