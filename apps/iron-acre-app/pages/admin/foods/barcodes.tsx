"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";

const ACCENT = "#FF8A2A";

function digits(s: string) {
  return String(s || "").replace(/\D/g, "");
}

export default function AdminBarcodeFoodsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const isAllowed = !!session && (role === "admin" || role === "gym");

  // Prefill from query ?code=...
  const [code, setCode] = useState("");
  useEffect(() => {
    if (router.query.code) setCode(digits(String(router.query.code)));
  }, [router.query.code]);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingSize, setServingSize] = useState("");
  const [image, setImage] = useState("");
  const [calories, setCalories] = useState<number | string>(0);
  const [protein, setProtein] = useState<number | string>(0);
  const [carbs, setCarbs] = useState<number | string>(0);
  const [fat, setFat] = useState<number | string>(0);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const valid = useMemo(() => code.length >= 8 && name.trim().length > 0, [code, name]);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!valid) {
      setMsg("Please enter a valid barcode and a name.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/foods/upsert-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "global",
          code,
          name,
          brand,
          image: image || null,
          servingSize: servingSize || null,
          calories: Number(calories) || 0,
          protein: Number(protein) || 0,
          carbs: Number(carbs) || 0,
          fat: Number(fat) || 0,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save");
      setMsg("Saved ✅");
    } catch (err: any) {
      setMsg(err?.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return <div className="container py-4">Checking access…</div>;
  if (!isAllowed) {
    return (
      <div className="container py-4">
        <Head><title>Barcode Foods • Admin</title></Head>
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
        <BottomNav />
      </div>
    );
  }

  return (
    <>
      <Head><title>Barcode Foods • Admin</title></Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">← Back to Admin</Link>
        </div>

        <h2 className="mb-3">Add / Update Barcode Food</h2>
        {msg && <div className={`alert ${msg.includes("Failed") ? "alert-danger" : "alert-info"}`}>{msg}</div>}

        <form className="futuristic-card p-3" onSubmit={save}>
          <div className="row g-2">
            <div className="col-12 col-md-5">
              <label className="form-label">Barcode</label>
              <input
                className="form-control"
                value={code}
                onChange={(e) => setCode(digits(e.target.value))}
                inputMode="numeric"
                placeholder="e.g. 5060088700797"
              />
              <small className="text-dim">EAN‑8 / UPC‑A / EAN‑13 / EAN‑14 supported</small>
            </div>
            <div className="col-12 col-md-7">
              <label className="form-label">Name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Protein Bar – Peanut" />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Brand (optional)</label>
              <input className="form-control" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Grenade" />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Serving (optional)</label>
              <input className="form-control" value={servingSize} onChange={(e) => setServingSize(e.target.value)} placeholder="e.g. 1 bar (45g)" />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Image URL (optional)</label>
              <input className="form-control" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label">Calories</label>
              <input className="form-control" type="number" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Protein (g)</label>
              <input className="form-control" type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Carbs (g)</label>
              <input className="form-control" type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Fat (g)</label>
              <input className="form-control" type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <button type="button" className="btn btn-outline-light" style={{ borderRadius: 24 }} onClick={() => router.push("/admin")}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ borderRadius: 24, background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, border: "none" }}
              disabled={!valid || busy}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </main>
      <BottomNav />
    </>
  );
}
