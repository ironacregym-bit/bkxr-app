"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const meals = ["Breakfast", "Lunch", "Dinner", "Snack"];

function gramsToFactor(g: number) {
  return g / 100;
}

// Custom debounce hook
function useDebounce(callback: (...args: any[]) => void, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedFn = (...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  };

  return debouncedFn;
}

export default function NutritionPage() {
  const { data: session } = useSession();
  const [activeMeal, setActiveMeal] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedFood, setSelectedFood] = useState<any | null>(null);
  const [grams, setGrams] = useState(100);
  const [adding, setAdding] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Fetch logs
  const { data: logsData } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${todayKey}` : null,
    fetcher
  );

  const totals = useMemo(() => {
    const entries = logsData?.entries || [];
    return entries.reduce(
      (acc: any, e: any) => {
        acc.calories += e.calories || 0;
        acc.protein += e.protein || 0;
        acc.carbs += e.carbs || 0;
        acc.fat += e.fat || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [logsData]);

  const debouncedSearch = useDebounce(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setLoadingSearch(false);
      return;
    }
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/foods/search?query=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.foods || []);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }, 300);

  useEffect(() => {
    if (activeMeal && query) debouncedSearch(query);
  }, [query, activeMeal, debouncedSearch]);

  const scaledSelected = useMemo(() => {
    if (!selectedFood) return null;
    const factor = gramsToFactor(grams);
    return {
      ...selectedFood,
      calories: Math.round((selectedFood.calories || 0) * factor),
      protein: +( (selectedFood.protein || 0) * factor ).toFixed(1),
      carbs: +( (selectedFood.carbs || 0) * factor ).toFixed(1),
      fat: +( (selectedFood.fat || 0) * factor ).toFixed(1),
    };
  }, [selectedFood, grams]);

  const addEntry = async () => {
    if (!session?.user?.email || !selectedFood || !activeMeal) return signIn("google");
    setAdding(true);
    try {
      const payload = {
        date: todayKey,
        meal: activeMeal,
        food: selectedFood,
        grams,
        calories: scaledSelected.calories,
        protein: scaledSelected.protein,
        carbs: scaledSelected.carbs,
        fat: scaledSelected.fat,
      };

      const optimisticEntry = {
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        ...payload,
      };

      mutate(
        `/api/nutrition/logs?date=${todayKey}`,
        (data: any) => ({ entries: [optimisticEntry, ...(data?.entries || [])] }),
        false
      );

      const res = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      mutate(`/api/nutrition/logs?date=${todayKey}`);
      setSelectedFood(null);
      setQuery("");
      setGrams(100);
      setActiveMeal(null);
      setManualEntry(false);
      setResults([]);
    } catch (err) {
      console.error(err);
      mutate(`/api/nutrition/logs?date=${todayKey}`);
    } finally {
      setAdding(false);
    }
  };

  const removeEntry = async (id: string) => {
    if (!confirm("Remove this entry?")) return;
    await fetch(`/api/nutrition/logs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    mutate(`/api/nutrition/logs?date=${todayKey}`);
  };

  return (
    <main className="container py-3" style={{ paddingBottom: "90px" }}>
      <h2 className="mb-3 text-center">Nutrition</h2>

      {/* Macros tiles */}
      <div className="d-flex justify-content-around mb-3">
        {["calories","protein","carbs","fat"].map((key) => (
          <div key={key} className="bxkr-card p-2 text-center" style={{flex:1, margin:"0 4px"}}>
            <div className="fw-bold text-uppercase">{key}</div>
            <div style={{ fontSize: "1.2rem", marginTop:4 }}>
              {totals[key as keyof typeof totals]}
              {key!=="calories"?"g":""}
            </div>
          </div>
        ))}
      </div>

      {/* Meals */}
      {meals.map((meal) => (
        <div key={meal} className="mb-4">
          <h5>{meal}</h5>
          {(logsData?.entries || [])
            .filter((e:any)=>e.meal===meal)
            .map((e:any)=>(
            <div key={e.id} className="d-flex align-items-center justify-content-between mb-2 bxkr-card p-2">
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                {e.food.image && <img src={e.food.image} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />}
                <div>
                  <div className="fw-bold">{e.food.name}</div>
                  <div className="small text-muted">{e.grams} g • {e.food.brand || ""}</div>
                </div>
              </div>
              <div className="text-end">
                <div className="fw-bold">{e.calories} kcal</div>
                <div className="small text-muted">{e.protein}p • {e.carbs}c • {e.fat}f</div>
                <button className="btn btn-link btn-sm text-danger" onClick={()=>removeEntry(e.id)}>Remove</button>
              </div>
            </div>
          ))}

          {/* Add food */}
          {activeMeal===meal ? (
            <div className="bxkr-card p-2 mt-2">
              {!manualEntry && (
                <>
                  <input
                    className="form-control mb-2"
                    placeholder="Search foods..."
                    value={query}
                    onChange={(e)=>setQuery(e.target.value)}
                  />
                  {loadingSearch && <div>Searching…</div>}
                  {results.length>0 && (
                    <div className="list-group mt-1">
                      {results.slice(0,10).map(f=>(
                        <button key={f.id} className="list-group-item list-group-item-action" onClick={()=>{setSelectedFood(f);setGrams(100)}}>
                          <div className="d-flex align-items-center">
                            {f.image && <img src={f.image} alt="" style={{ width:48,height:48,objectFit:"cover",borderRadius:6,marginRight:8 }}/>}
                            <div style={{flex:1}}>
                              <div className="fw-bold">{f.name}</div>
                              <div className="small text-muted">{f.brand || ""}</div>
                            </div>
                            <div className="text-end small">{f.calories?`${Math.round(f.calories)} kcal/100g`:"-"}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="btn btn-link mt-2" onClick={()=>setManualEntry(true)}>Add manually</button>
                </>
              )}

              {(manualEntry || selectedFood) && (
                <div className="mt-2">
                  <input
                    type="text"
                    className="form-control mb-2"
                    placeholder="Food name"
                    value={selectedFood?.name || ""}
                    onChange={e=>setSelectedFood({...selectedFood,name:e.target.value})}
                  />
                  <input type="number" className="form-control mb-2" placeholder="Grams" value={grams} onChange={e=>setGrams(Number(e.target.value||0))}/>
                  <input type="number" className="form-control mb-2" placeholder="Calories" value={selectedFood?.calories||0} onChange={e=>setSelectedFood({...selectedFood,calories:Number(e.target.value)})}/>
                  <input type="number" className="form-control mb-2" placeholder="Protein" value={selectedFood?.protein||0} onChange={e=>setSelectedFood({...selectedFood,protein:Number(e.target.value)})}/>
                  <input type="number" className="form-control mb-2" placeholder="Carbs" value={selectedFood?.carbs||0} onChange={e=>setSelectedFood({...selectedFood,carbs:Number(e.target.value)})}/>
                  <input type="number" className="form-control mb-2" placeholder="Fat" value={selectedFood?.fat||0} onChange={e=>setSelectedFood({...selectedFood,fat:Number(e.target.value)})}/>
                  <div className="d-flex gap-2">
                    <button className="btn btn-primary" onClick={addEntry} disabled={adding}>{adding?"Adding…":"Add"}</button>
                    <button className="btn btn-outline-secondary" onClick={()=>{setSelectedFood(null);setQuery("");setActiveMeal(null);setManualEntry(false);setResults([])}}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button className="btn btn-outline-primary mt-2" onClick={()=>setActiveMeal(meal)}>Add Food</button>
          )}
        </div>
      ))}
  </main>
      <BottomNav />
  );
}