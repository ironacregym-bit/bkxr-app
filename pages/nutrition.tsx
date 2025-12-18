
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const meals = ["Breakfast", "Lunch", "Dinner", "Snack"];

function round2(n: number | undefined) {
  return n !== undefined ? Number(n).toFixed(2) : "-";
}

// Futuristic colour palette
const COLORS = {
  calories: "#ff7f32", // Neon orange
  protein: "#32ff7f",  // Electric green
  carbs: "#ffc107",    // Amber yellow
  fat: "#ff4fa3",      // Hot pink
};

export default function NutritionPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [openMeal, setOpenMeal] = useState<string | null>(null);

  // Date navigation state
  const [selectedDate, setSelectedDate] = useState(new Date());
  useEffect(() => {
    if (router.query.date) {
      const parsed = new Date(router.query.date as string);
      if (!isNaN(parsed.getTime())) setSelectedDate(parsed);
    }
  }, [router.query.date]);

  const formattedDate = useMemo(() => selectedDate.toISOString().slice(0, 10), [selectedDate]);
  const goPrevDay = () => setSelectedDate((d) => new Date(d.getTime() - 86400000));
  const goNextDay = () => {
    const tomorrow = new Date(selectedDate.getTime() + 86400000);
    if (tomorrow <= new Date()) setSelectedDate(tomorrow);
  };

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedFood, setSelectedFood] = useState<any | null>(null);
  const [grams, setGrams] = useState(100);
  const [adding, setAdding] = useState(false);

  // Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<any | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<any>(null);
  const scannedOnce = useRef(false);

  // Fetch logs for selected date
  const { data: logsData } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${formattedDate}` : null,
    fetcher
  );

  // Fetch user goals
  const { data: profile } = useSWR(
    session?.user?.email ? `/api/profile?email=${encodeURIComponent(session.user.email)}` : null,
    fetcher
  );
  const goals = {
    calories: profile?.caloric_target || 2000,
    protein: profile?.protein_target || 150,
    carbs: profile?.carb_target || 250,
    fat: profile?.fat_target || 70,
  };

  // Totals
  const totals = useMemo(() => {
    const entries = logsData?.entries || [];
    return entries.reduce(
      (acc: { calories: number; protein: number; carbs: number; fat: number }, e: any) => {
        acc.calories += e.calories || 0;
        acc.protein += e.protein || 0;
        acc.carbs += e.carbs || 0;
        acc.fat += e.fat || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [logsData]);

  const progress = {
    calories: Math.min(100, (totals.calories / goals.calories) * 100),
    protein: Math.min(100, (totals.protein / goals.protein) * 100),
    carbs: Math.min(100, (totals.carbs / goals.carbs) * 100),
    fat: Math.min(100, (totals.fat / goals.fat) * 100),
  };

  // Debounce search
  function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
    let timer: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  const doSearch = useMemo(
    () =>
      debounce(async (q: string) => {
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
        } catch {
          setResults([]);
        } finally {
          setLoadingSearch(false);
        }
      }, 300),
    []
  );

  useEffect(() => {
    doSearch(query);
  }, [query, doSearch]);

  const scaledSelected = useMemo(() => {
    if (!selectedFood) return null;
    const factor = grams / 100;
    return {
      ...selectedFood,
      calories: +(selectedFood.calories * factor).toFixed(2),
      protein: +(selectedFood.protein * factor).toFixed(2),
      carbs: +(selectedFood.carbs * factor).toFixed(2),
      fat: +(selectedFood.fat * factor).toFixed(2),
    };
  }, [selectedFood, grams]);

  const addEntry = async (meal: string, food: any) => {
    if (!session?.user?.email || !food) return signIn("google");
    setAdding(true);
    try {
      const payload = {
        date: formattedDate,
        meal,
        food,
        grams,
        calories: scaledSelected!.calories,
        protein: scaledSelected!.protein,
        carbs: scaledSelected!.carbs,
        fat: scaledSelected!.fat,
      };

      const optimistic = { id: `temp-${Date.now()}`, created_at: new Date().toISOString(), ...payload };
      mutate(
        `/api/nutrition/logs?date=${formattedDate}`,
        (data: any) => ({ entries: [optimistic, ...(data?.entries || [])] }),
        false
      );

      const res = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");

      mutate(`/api/nutrition/logs?date=${formattedDate}`);
      setSelectedFood(null);
      setQuery("");
      setResults([]);
      setGrams(100);
    } finally {
      setAdding(false);
    }
  };

  const removeEntry = async (id: string) => {
    if (!confirm("Remove this entry?")) return;
    await fetch(`/api/nutrition/logs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    mutate(`/api/nutrition/logs?date=${formattedDate}`);
  };

  // ===== Barcode scanning =====
  const openScanner = async () => {
    setScannerOpen(true);
    setScanError(null);
    setHasCamera(true);
    setLookupResult(null);
    setLookupLoading(false);
    scannedOnce.current = false;
  };

  const stopTracks = () => {
    try {
      const v = videoRef.current;
      v?.srcObject && (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    } catch (_) {}
  };

  const closeScanner = () => {
    setScannerOpen(false);
    setScanning(false);
    setScanError(null);
    setLookupLoading(false);
    scannedOnce.current = false;
    try {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    } catch (_) {}
    stopTracks();
  };

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      if (!scannerOpen) return;
      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        setHasCamera(false);
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === "videoinput");
        if (!cameras.length) {
          setHasCamera(false);
          return;
        }

        setScanning(true);
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        codeReaderRef.current = reader;

        // Prefer back camera on mobile
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // Attach the stream to the video element manually (helps on iOS Safari)
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Use ZXing decoder on the existing video element
        const controls: IScannerControls = await reader.decodeFromVideoDevice(
          null,
          videoRef.current!,
          (result, err) => {
            if (!mounted) return;
            if (result && !scannedOnce.current) {
              scannedOnce.current = true;
              const code = result.getText();

              // 👉 Populate the textbox with the scanned code
              setBarcodeInput(code);

              // Keep the modal open and auto lookup; show result below input
              void handleBarcode(code, { keepOpen: true });
            }
            // ignore NotFoundException bursts while scanning
          }
        );

        // When modal closes, stop and reset
        return () => {
          controls?.stop();
        };
      } catch (err: any) {
        console.error("[scanner] error:", err?.message || err);
        setScanError("Unable to access camera. You can enter the barcode manually.");
        setHasCamera(false);
        setScanning(false);
        stopTracks();
      }
    }

    const teardown = startScanner();
    return () => {
      (async () => {
        try {
          if (codeReaderRef.current) codeReaderRef.current.reset();
        } catch {}
        stopTracks();
        (await teardown)?.toString(); // no-op, keeps types happy
      })();
      mounted = false;
    };
  }, [scannerOpen]);

  const handleBarcode = async (code: string, opts: { keepOpen?: boolean } = {}) => {
    try {
      setLookupLoading(true);
      setLookupResult(null);
      const res = await fetch(`/api/foods/search?barcode=${encodeURIComponent(code)}`);
      const json = await res.json();
      const found = (json.foods || [])[0];
      if (!found) {
        setScanError("No product found for this barcode. You can add a manual food.");
        setLookupLoading(false);
        return;
      }
      setLookupResult(found);
      setSelectedFood(found);
      setGrams(100);
      // Open a default meal if none is open
      setOpenMeal((prev) => prev || "Breakfast");
      setLookupLoading(false);

      if (!opts.keepOpen) {
        closeScanner();
      }
    } catch (e) {
      console.error(e);
      setScanError("Barcode lookup failed. Please try again or enter manually.");
      setLookupLoading(false);
    }
  };

  const lookupManualBarcode = async () => {
    if (!barcodeInput || barcodeInput.trim().length < 6) {
      setScanError("Enter a valid barcode (at least 6 digits).");
      return;
    }
    await handleBarcode(barcodeInput.trim(), { keepOpen: true });
  };

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff", borderRadius: "12px" }}>
        {/* Date Navigation */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button className="btn btn-bxkr-outline" onClick={goPrevDay}>
            ← Previous
          </button>
          <h2 className="text-center mb-0" style={{ fontWeight: 700 }}>
            Nutrition ({formattedDate})
          </h2>
          <button
            className="btn btn-bxkr-outline"
            onClick={goNextDay}
            disabled={formattedDate === new Date().toISOString().slice(0, 10)}
          >
            Next →
          </button>
        </div>

        {/* Top Section */}
        <div className="row mb-4">
          {/* Left Column */}
          <div className="col-6">
            <div className="bxkr-card p-3">
              <h5 className="mb-3">Macros</h5>
              <p style={{ color: COLORS.calories }}>Calories: {round2(totals.calories)} / {goals.calories}</p>
              <p style={{ color: COLORS.protein }}>Protein: {round2(totals.protein)} / {goals.protein} g</p>
              <p style={{ color: COLORS.carbs }}>Carbs: {round2(totals.carbs)} / {goals.carbs} g</p>
              <p style={{ color: COLORS.fat }}>Fat: {round2(totals.fat)} / {goals.fat} g</p>
            </div>
          </div>

          {/* Right Column - Concentric Rings */}
          <div className="col-6 d-flex justify-content-center">
            <div style={{ position: "relative", width: 180, height: 180 }}>
              {/* Calories */}
              <div style={{ position: "absolute", top: 0, left: 0, width: 180, height: 180 }}>
                <CircularProgressbar
                  value={progress.calories}
                  strokeWidth={7}
                  styles={buildStyles({
                    pathColor: COLORS.calories,
                    trailColor: "rgba(255,127,50,0.15)",
                    strokeLinecap: "butt",
                    pathTransitionDuration: 0.8,
                  })}
                />
              </div>
              {/* Protein */}
              <div style={{ position: "absolute", top: 14, left: 14, width: 152, height: 152 }}>
                <CircularProgressbar
                  value={progress.protein}
                  strokeWidth={8}
                  styles={buildStyles({
                    pathColor: COLORS.protein,
                    trailColor: "rgba(50,255,127,0.15)",
                    strokeLinecap: "butt",
                    pathTransitionDuration: 0.8,
                  })}
                />
              </div>
              {/* Carbs */}
              <div style={{ position: "absolute", top: 28, left: 28, width: 124, height: 124 }}>
                <CircularProgressbar
                  value={progress.carbs}
                  strokeWidth={10}
                  styles={buildStyles({
                    pathColor: COLORS.carbs,
                    trailColor: "rgba(255,193,7,0.15)",
                    strokeLinecap: "butt",
                    pathTransitionDuration: 0.8,
                  })}
                />
              </div>
              {/* Fat */}
              <div style={{ position: "absolute", top: 42, left: 42, width: 96, height: 96 }}>
                <CircularProgressbar
                  value={progress.fat}
                  strokeWidth={12}
                  styles={buildStyles({
                    pathColor: COLORS.fat,
                    trailColor: "rgba(255,79,163,0.15)",
                    strokeLinecap: "butt",
                    pathTransitionDuration: 0.8,
                  })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Meals */}
        {meals.map((meal) => {
          const mealEntries = logsData?.entries?.filter((e: any) => e.meal === meal) || [];
          const isOpen = openMeal === meal;
          const mealTotals = mealEntries.reduce(
            (acc: { calories: number; protein: number; carbs: number; fat: number }, e: any) => {
              acc.calories += e.calories || 0;
              acc.protein += e.protein || 0;
              acc.carbs += e.carbs || 0;
              acc.fat += e.fat || 0;
              return acc;
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          return (
            <div key={meal} className="mb-3">
              <button
                className="btn btn-bxkr-outline w-100 mb-2 text-start"
                style={{ borderRadius: "12px" }}
                onClick={() => setOpenMeal(isOpen ? null : meal)}
              >
                {meal} ({mealEntries.length}) —{" "}
                <span style={{ color: COLORS.calories }}>{round2(mealTotals.calories)} kcal</span>{" "}
                | <span style={{ color: COLORS.protein }}>{round2(mealTotals.protein)}p</span>{" "}
                | <span style={{ color: COLORS.carbs }}>{round2(mealTotals.carbs)}c</span>{" "}
                | <span style={{ color: COLORS.fat }}>{round2(mealTotals.fat)}f</span>
              </button>

              {isOpen && (
                <div className="px-2">
                  <div className="d-flex gap-2 mb-2">
                    <input
                      className="form-control"
                      placeholder={`Search foods for ${meal}…`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button className="btn btn-bxkr" onClick={openScanner}>
                      Scan barcode
                    </button>
                  </div>

                  {loadingSearch && <div>Searching…</div>}

                  {results.length > 0 &&
                    results.slice(0, 5).map((f) => (
                      <div key={f.id ?? f.code ?? f.name} className="mb-1">
                        {selectedFood?.id === f.id ? (
                          <div className="bxkr-card p-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <div className="d-flex align-items-center gap-2">
                                <input
                                  type="number"
                                  className="form-control"
                                  style={{ maxWidth: 100 }}
                                  value={grams}
                                  onChange={(e) => setGrams(Number(e.target.value))}
                                />
                                {/* Quick presets */}
                                <div className="d-flex gap-2">
                                  {[50, 100, 150, 200].map((g) => (
                                    <button
                                      key={g}
                                      className="bxkr-chip"
                                      onClick={() => setGrams(g)}
                                    >
                                      {g}g
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="text-end">
                                <span style={{ color: COLORS.calories }}>{round2(scaledSelected?.calories)} kcal</span>{" "}
                                | <span style={{ color: COLORS.protein }}>{round2(scaledSelected?.protein)}p</span>{" "}
                                | <span style={{ color: COLORS.carbs }}>{round2(scaledSelected?.carbs)}c</span>{" "}
                                | <span style={{ color: COLORS.fat }}>{round2(scaledSelected?.fat)}f</span>
                              </div>
                            </div>
                            <button
                              className="btn btn-bxkr w-100 mb-2"
                              onClick={() => addEntry(meal, selectedFood)}
                              disabled={adding}
                            >
                              Add to {meal} {adding && <span className="inline-spinner" />}
                            </button>
                            <div className="fw-bold">
                              {f.name} ({f.brand}) — {round2(f.calories)} kcal/100g
                            </div>
                          </div>
                        ) : (
                          <button
                            className="list-group-item list-group-item-action"
                            style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }}
                            onClick={() => setSelectedFood(f)}
                          >
                            {f.name} ({f.brand}) — {round2(f.calories)} kcal/100g
                          </button>
                        )}
                      </div>
                    ))}

                  <button
                    className="btn btn-bxkr-outline w-100 mb-2"
                    style={{ borderRadius: "12px" }}
                    onClick={() =>
                      setSelectedFood({
                        id: `manual-${Date.now()}`,
                        name: "",
                        calories: 0,
                        protein: 0,
                        carbs: 0,
                        fat: 0,
                        brand: "",
                      })
                    }
                  >
                    Add manual food
                  </button>

                  {mealEntries.map((e: any) => (
                    <div
                      key={e.id}
                      className="bxkr-card p-3 mb-2 d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <div className="fw-bold">{e.food.name} ({e.food.brand})</div>
                        <div className="small text-dim">{e.grams} g</div>
                        <div className="small">
                          <span style={{ color: COLORS.calories }}>{round2(e.calories)} kcal</span>{" "}
                          | <span style={{ color: COLORS.protein }}>{round2(e.protein)}p</span>{" "}
                          | <span style={{ color: COLORS.carbs }}>{round2(e.carbs)}c</span>{" "}
                          | <span style={{ color: COLORS.fat }}>{round2(e.fat)}f</span>
                        </div>
                      </div>
                      <button className="btn btn-link text-danger" onClick={() => removeEntry(e.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Scanner Modal */}
      {scannerOpen && (
        <div className="bxkr-modal">
          <div className="bxkr-modal-backdrop" onClick={closeScanner} />
          <div className="bxkr-modal-dialog bxkr-card">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="mb-0">Scan barcode</h5>
              <button className="btn btn-bxkr-outline" onClick={closeScanner}>Close</button>
            </div>

            {hasCamera ? (
              <>
                <div className="scanner-box mb-2">
                  <video
                    ref={videoRef}
                    className="scanner-video"
                    autoPlay
                    playsInline
                    muted
                  />
                  <div className="scanner-hint text-dim">
                    Align the barcode within the frame. {scanning ? "Scanning…" : "Initialising…"}
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <input
                    className="form-control"
                    placeholder="e.g. 5051234567890"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    inputMode="numeric"
                  />
                  <button className="btn btn-bxkr" onClick={lookupManualBarcode} disabled={lookupLoading}>
                    {lookupLoading ? "Looking up…" : "Lookup"}
                  </button>
                </div>

                {scanError && <div className="mt-2 text-danger">{scanError}</div>}

                {lookupResult && (
                  <div className="bxkr-card p-2 mt-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="me-2">
                        <div className="fw-bold">{lookupResult.name} ({lookupResult.brand})</div>
                        <div className="small text-dim">{round2(lookupResult.calories)} kcal / 100g</div>
                      </div>
                      <button
                        className="btn btn-bxkr-outline"
                        onClick={() => {
                          // Keep selected and close the scanner
                          closeScanner();
                        }}
                      >
                        Use this
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mb-2">
                <div className="mb-2 text-dim">Camera not available. Enter the barcode manually:</div>
                <div className="d-flex gap-2">
                  <input
                    className="form-control"
                    placeholder="e.g. 5051234567890"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    inputMode="numeric"
                  />
                  <button className="btn btn-bxkr" onClick={lookupManualBarcode} disabled={lookupLoading}>
                    {lookupLoading ? "Looking up…" : "Lookup"}
                  </button>
                </div>
                {scanError && <div className="mt-2 text-danger">{scanError}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}

