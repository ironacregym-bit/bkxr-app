
// pages/recipes/index.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

type Recipe = { id: string; title: string; meal_type: "breakfast"|"lunch"|"dinner"|"snack"; image?: string|null; per_serving?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number } };
const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function RecipesPage() {
  const { status } = useSession();
  const authed = status === "authenticated";

  const [mealType, setMealType] = useState<Recipe["meal_type"]>("breakfast");
  const [q, setQ] = useState("");

  const { data } = useSWR<{ recipes: Recipe[] }>(
    authed ? `/api/recipes/list?meal_type=${mealType}&q=${encodeURIComponent(q)}` : null, fetcher
  );
  const recipes = useMemo(() => data?.recipes || [], [data]);

  return (
    <>
      <Head><title>Recipes • BXKR</title></Head>
      <main className="container py-3" style={{ paddingBottom: 80, minHeight: "100vh" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h1 className="h5 m-0">Recipes</h1>
          <Link href="/nutrition-home" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
            <i className="fas fa-arrow-left" /> Back
          </Link>
        </div>

        <div className="futuristic-card p-3 mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2 justify-content-between">
            <div className="d-flex gap-2">
              {(["breakfast","lunch","dinner","snack"] as const).map(mt => (
                <button key={mt} className="btn-bxkr-outline" aria-pressed={mealType === mt} onClick={() => setMealType(mt)}>
                  {mt[0].toUpperCase() + mt.slice(1)}
                </button>
              ))}
            </div>
            <input className="form-control" placeholder="Search recipes…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
          </div>
        </div>

        <section className="mb-3">
          <div className="row g-2">
            {recipes.map((r) => (
              <div key={r.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                <Link href={`/recipes/${r.id}`} className="bxkr-card p-2 text-decoration-none" style={{ display: "block", color: "inherit", borderRadius: 12 }}>
                  {r.image ? (
                    <img src={r.image} alt={r.title} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 12 }} />
                  ) : (
                    <div className="text-dim" style={{ height: 140, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid var(--bxkr-card-border)", borderRadius: 12 }}>
                      No image
                    </div>
                  )}
                  <div className="mt-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="fw-semibold">{r.title}</div>
                      <span className="bxkr-chip text-capitalize">{r.meal_type}</span>
                    </div>
                    <div className="text-dim" style={{ fontSize: 13 }}>
                      {Math.round(r.per_serving?.calories || 0)} kcal • P{Math.round(r.per_serving?.protein_g || 0)} • C{Math.round(r.per_serving?.carbs_g || 0)} • F{Math.round(r.per_serving?.fat_g || 0)}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
            {!recipes.length && <div className="text-dim">No recipes found.</div>}
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
