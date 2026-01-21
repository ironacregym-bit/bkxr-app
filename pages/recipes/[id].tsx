
// pages/recipes/[id].tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

type Ingredient = {
  name?: string;
  ingredient?: string;
  title?: string;
  qty?: number;
  quantity?: number;
  amount?: number;
  grams?: number;
  unit?: string;
  uom?: string;
};
type Recipe = {
  id: string;
  title: string;
  image?: string | null;
  servings?: number;
  ingredients?: Ingredient[];
  items?: Ingredient[];
  instructions?: string[] | string;
};
type ShoppingListMeta = { id: string; name: string; people: number; created_at: string; updated_at: string };

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function getName(x: Ingredient): string {
  return String(x.name || x.ingredient || x.title || "").trim();
}
function getQty(x: Ingredient): number | null {
  const raw = x.qty ?? x.quantity ?? x.amount ?? x.grams;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function getUnit(x: Ingredient): string | null {
  const u = x.unit || x.uom || (x.grams != null ? "g" : null);
  return u ? String(u) : null;
}

export default function RecipeDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";

  const { status } = useSession();
  const authed = status === "authenticated";

  const { data: recipe } = useSWR<Recipe>(
    authed && id ? `/api/recipes/get?id=${encodeURIComponent(id)}` : null,
    fetcher
  );
  const { data: favResp, mutate: mutateFavs } = useSWR<{ favourites: string[] }>(
    authed ? `/api/recipes/favourites?limit=200` : null,
    fetcher
  );
  const fav = useMemo(() => !!favResp?.favourites?.includes(id), [favResp, id]);

  // Lists for "Add to shopping list"
  const { data: listsResp } = useSWR<{ lists: ShoppingListMeta[] }>(
    authed ? "/api/shopping/lists" : null,
    fetcher
  );
  const lists = useMemo(() => listsResp?.lists || [], [listsResp]);

  const title = recipe?.title || "Recipe";
  const ingredients: Ingredient[] = useMemo(() => {
    if (!recipe) return [];
    return Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : Array.isArray(recipe.items)
      ? recipe.items
      : [];
  }, [recipe]);

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggleFav(makeFav: boolean) {
    try {
      if (makeFav) {
        await fetch("/api/recipes/favourites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe_id: id }),
        });
      } else {
        await fetch(`/api/recipes/favourites?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      await mutateFavs();
    } catch {}
  }

  // Add to list controls
  const [listId, setListId] = useState<string>("");
  const [people, setPeople] = useState<string>("1");

  async function addToList() {
    if (!id || !listId) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addRecipe",
          list_id: listId,
          recipe_id: id,
          people: Math.max(1, Number(people) || 1),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to add to list");
      setMsg("Recipe added to your shopping list");
    } catch (e: any) {
      setMsg(e?.message || "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>{title} • BXKR</title>
      </Head>
      <main className="container py-3" style={{ paddingBottom: 80, minHeight: "100vh" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h1 className="h5 m-0">{title}</h1>
          <Link href="/recipes" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
            <i className="fas fa-arrow-left" /> Back
          </Link>
        </div>

        {msg && <div className="alert alert-info">{msg}</div>}

        {/* Header + favourite */}
        <div className="futuristic-card p-3 mb-3">
          {recipe?.image ? (
            <img
              src={recipe.image}
              alt={title}
              style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 12 }}
            />
          ) : (
            <div
              className="text-dim"
              style={{
                height: 160,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--bxkr-card-border)",
                borderRadius: 12,
              }}
            >
              No image
            </div>
          )}
          <div className="d-flex align-items-center justify-content-between mt-2">
            <div className="text-dim" style={{ fontSize: 13 }}>
              Servings: {recipe?.servings ?? 1}
            </div>
            <button
              aria-label={fav ? "Remove from favourites" : "Add to favourites"}
              className="btn btn-bxkr-outline btn-sm"
              style={{ borderRadius: 24 }}
              onClick={() => toggleFav(!fav)}
            >
              <i className="fas fa-heart" style={{ color: fav ? "#ff4d6d" : "#cfd7df" }} />{" "}
              {fav ? "Favourited" : "Favourite"}
            </button>
          </div>
        </div>

        {/* Add to Shopping List */}
        <div className="futuristic-card p-3 mb-3">
          <h6 className="mb-2" style={{ fontWeight: 700 }}>
            Add to Shopping List
          </h6>
          <div className="d-flex flex-wrap align-items-end" style={{ gap: 8 }}>
            <select
              className="form-select"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              style={{ minWidth: 220 }}
              aria-label="Select shopping list"
            >
              <option value="">Select a list…</option>
              {lists.map((L) => (
                <option key={L.id} value={L.id}>
                  {L.name}
                </option>
              ))}
            </select>
            <input
              className="form-control"
              type="number"
              min={1}
              placeholder="People"
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              style={{ width: 120 }}
            />
            <button
              className="btn btn-bxkr-outline btn-sm"
              onClick={addToList}
              disabled={!listId || !id || busy}
              style={{ borderRadius: 24 }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Ingredients */}
        <div className="futuristic-card p-3 mb-3">
          <h6 className="mb-2" style={{ fontWeight: 700 }}>
            Ingredients
          </h6>
          {!ingredients.length ? (
            <div className="text-dim">No ingredients listed.</div>
          ) : (
            <ul className="m-0">
              {ingredients.map((ing, idx) => (
                <li
                  key={idx}
                  className="d-flex align-items-center justify-content-between"
                  style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div>{getName(ing) || "Ingredient"}</div>
                  <div className="text-dim" style={{ fontSize: 12 }}>
                    {getQty(ing) ?? "-"} {getUnit(ing) ?? ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Instructions */}
        <div className="futuristic-card p-3">
          <h6 className="mb-2" style={{ fontWeight: 700 }}>
            Instructions
          </h6>
          {!recipe?.instructions ? (
            <div className="text-dim">No instructions provided.</div>
          ) : Array.isArray(recipe.instructions) ? (
            <ol className="m-0" style={{ paddingLeft: 18 }}>
              {recipe.instructions.map((s, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {s}
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0">{String(recipe.instructions)}</p>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
