
// pages/shopping/index.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

type ShoppingListMeta = { id: string; name: string; people: number; created_at: string; updated_at: string };
const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

export default function ShoppingListsPage() {
  const { status } = useSession();
  const authed = status === "authenticated";

  const { data, mutate } = useSWR<{ lists: ShoppingListMeta[] }>(authed ? "/api/shopping/lists" : null, fetcher, {
    revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000,
  });
  const lists = useMemo(() => data?.lists || [], [data]);

  const [name, setName] = useState("");
  const [people, setPeople] = useState("1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function createList() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/shopping/lists", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() || "My List", people: Math.max(1, Number(people) || 1) })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to create");
      setName(""); setPeople("1"); await mutate(); setMsg("List created");
    } catch (e: any) { setMsg(e?.message || "Failed"); } finally { setBusy(false); }
  }
  async function deleteList(id: string) {
    if (!confirm("Delete this list and its items/meals?")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/shopping/lists", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to delete");
      await mutate(); setMsg("List deleted");
    } catch (e: any) { setMsg(e?.message || "Failed"); } finally { setBusy(false); }
  }

  return (
    <>
      <Head><title>Shopping Lists • BXKR</title></Head>
      <main className="container py-3" style={{ paddingBottom: 80, minHeight: "100vh" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h1 className="h5 m-0">Shopping Lists</h1>
          <Link href="/nutrition-home" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
            <i className="fas fa-arrow-left" /> Back
          </Link>
        </div>

        <div className="futuristic-card p-3 mb-3">
          <div className="d-flex flex-wrap align-items-end" style={{ gap: 8 }}>
            <input className="form-control" placeholder="List name" value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 200, flex: 1 }} />
            <input className="form-control" type="number" min={1} placeholder="People" value={people} onChange={(e) => setPeople(e.target.value)} style={{ width: 120 }} />
            <button className="btn btn-sm" onClick={createList} disabled={busy} style={{ borderRadius: 24, color: "#fff", background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, boxShadow: `0 0 14px ${ACCENT}66`, border: "none", paddingInline: 14 }}>
              Create
            </button>
          </div>
          {msg && <div className="alert alert-info mt-2 mb-0">{msg}</div>}
        </div>

        <div className="futuristic-card p-3">
          {!lists.length ? (
            <div className="text-dim">No lists yet.</div>
          ) : (
            <ul className="list-unstyled m-0">
              {lists.map((L) => (
                <li key={L.id} className="d-flex align-items-center justify-content-between" style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div>
                    <div className="fw-semibold">{L.name}</div>
                    <div className="text-dim" style={{ fontSize: 12 }}>{L.people} people</div>
                  </div>
                  <div className="d-flex" style={{ gap: 8 }}>
                    <Link href={`/shopping/${L.id}`} className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>Open</Link>
                    <button className="btn btn-bxkr-outline btn-sm" onClick={() => deleteList(L.id)} style={{ borderRadius: 24 }}>Delete</button>
                  </div>
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
