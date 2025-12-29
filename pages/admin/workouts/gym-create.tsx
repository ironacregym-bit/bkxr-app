
// pages/admin/workouts/gym-create.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { useState } from "react";
import BottomNav from "../../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type SingleItem = {
  type: "Single";
  order: number;
  exercise_id: string;
  sets?: number;
  reps?: string;
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

type SupersetItem = {
  type: "Superset";
  order: number;
  name?: string | null;
  items: Array<{ exercise_id: string; reps?: string; weight_kg?: number | null }>;
  sets?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

type GymRound = {
  name: string;
  order: number;
  items: Array<SingleItem | SupersetItem>;
};

export default function GymCreateWorkoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const ownerEmail = session?.user?.email || "";
  const role = (session?.user as any)?.role || "user";

  const { data } = useSWR("/api/exercises?limit=1000", fetcher, { revalidateOnFocus: false });
  const exercises = Array.isArray(data?.exercises) ? data!.exercises : [];

  // Base form
  const [meta, setMeta] = useState({
    workout_name: "",
    focus: "",
    notes: "",
    video_url: "",
    visibility: "global" as "global" | "private",
  });

  const [warmup, setWarmup] = useState<GymRound | null>({ name: "Warm Up", order: 1, items: [] });
  const [main, setMain] = useState<GymRound>({ name: "Main Set", order: 2, items: [] });
  const [finisher, setFinisher] = useState<GymRound | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (status === "loading") return <div className="container py-4">Checking access…</div>;
  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  function addSingle(round: "warmup" | "main" | "finisher") {
    const newItem: SingleItem = { type: "Single", order: 1, exercise_id: "", reps: "", sets: 3 };
    if (round === "warmup") setWarmup((prev) => prev ? { ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] } : prev);
    if (round === "main") setMain((prev) => ({ ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] }));
    if (round === "finisher") setFinisher((prev) => prev ? { ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] } : { name: "Finisher", order: 3, items: [newItem] });
  }

  function addSuperset(round: "warmup" | "main" | "finisher") {
    const newItem: SupersetItem = { type: "Superset", order: 1, name: "", items: [{ exercise_id: "", reps: "" }, { exercise_id: "", reps: "" }], sets: 3 };
    if (round === "warmup") setWarmup((prev) => prev ? { ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] } : prev);
    if (round === "main") setMain((prev) => ({ ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] }));
    if (round === "finisher") setFinisher((prev) => prev ? { ...prev, items: [...prev.items, { ...newItem, order: prev.items.length + 1 }] } : { name: "Finisher", order: 3, items: [newItem] });
  }

  function updateSingle(round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SingleItem>) {
    const up = (r: GymRound | null) => r ? { ...r, items: r.items.map((it, i) => i === idx ? { ...(it as SingleItem), ...patch } : it) } : r;
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  function updateSuperset(round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SupersetItem>) {
    const up = (r: GymRound | null) => r ? { ...r, items: r.items.map((it, i) => i === idx ? { ...(it as SupersetItem), ...patch } : it) } : r;
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  function setSupersetExercise(round: "warmup" | "main" | "finisher", idx: number, subIdx: number, exercise_id: string) {
    const up = (r: GymRound | null) => r ? {
      ...r,
      items: r.items.map((it, i) => {
        if (i !== idx) return it;
        const ss = it as SupersetItem;
        const newItems = [...ss.items];
        newItems[subIdx] = { ...newItems[subIdx], exercise_id };
        return { ...ss, items: newItems };
      })
    } : r;
    if (round === "warmup") setWarmup((prev) => up(prev));
    if (round === "main") setMain((prev) => up(prev) as GymRound);
    if (round === "finisher") setFinisher((prev) => up(prev));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        visibility: meta.visibility,
        owner_email: meta.visibility === "private" ? ownerEmail : undefined,
        workout_name: meta.workout_name.trim(),
        focus: meta.focus.trim() || undefined,
        notes: meta.notes.trim() || undefined,
        video_url: meta.video_url.trim() || undefined,
        warmup,
        main,
        finisher,
      };

      const res = await fetch("/api/workouts/gym-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create gym workout");
      setMsg("Created ✅");
      setTimeout(() => router.push(`/workouts/${json.workout_id}`), 700);
    } catch (e: any) {
      setMsg(e?.message || "Failed to create workout");
    } finally {
      setSaving(false);
    }
  }

  const ACCENT = "#FF8A2A";

  return (
    <>
      <Head><title>Create Gym Workout • Admin</title></Head>
      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">← Back to Admin</Link>
        </div>

        <h2 className="mb-3">Create Gym Workout</h2>
        {msg && <div className={`alert ${msg.includes("Failed") ? "alert-danger" : "alert-info"}`}>{msg}</div>}

        {/* Meta */}
        <section className="bxkr-card p-3 mb-3">
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Workout Name</label>
              <input className="form-control" value={meta.workout_name}
                     onChange={(e) => setMeta({ ...meta, workout_name: e.target.value })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Visibility</label>
              <select className="form-select" value={meta.visibility}
                      onChange={(e) => setMeta({ ...meta, visibility: e.target.value as any })}>
                <option value="global">Global</option>
                <option value="private">Private</option>
              </select>
              {meta.visibility === "private" && <small className="text-muted">Owner: {ownerEmail || "—"}</small>}
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Focus</label>
              <input className="form-control" value={meta.focus}
                     onChange={(e) => setMeta({ ...meta, focus: e.target.value })} placeholder="e.g., Upper Body" />
            </div>
            <div className="col-12">
              <label className="form-label">Notes</label>
              <textarea className="form-control" value={meta.notes}
                        onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Video URL</label>
              <input className="form-control" value={meta.video_url}
                     onChange={(e) => setMeta({ ...meta, video_url: e.target.value })} placeholder="https://…" />
            </div>
          </div>
        </section>

        {/* Warm Up */}
        <section className="bxkr-card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Warm Up</h6>
            <div className="d-flex gap-2">
              <button className="btn btn-sm" style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }} onClick={() => addSingle("warmup")}>+ Single</button>
              <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }} onClick={() => addSuperset("warmup")}>+ Superset</button>
            </div>
          </div>
          {warmup?.items.length ? warmup.items.map((it, idx) => (
            <div key={`wu-${idx}`} className="row g-2 mb-2">
              {it.type === "Single" ? (
                <>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Exercise</label>
                    <select className="form-select" value={(it as SingleItem).exercise_id}
                            onChange={(e) => updateSingle("warmup", idx, { exercise_id: e.target.value })}>
                      <option value="">— Select —</option>
                      {exercises.map((e: any) => <option key={e.id} value={e.id}>{e.exercise_name} {e.type ? `• ${e.type}` : ""}</option>)}
                    </select>
                  </div>
                  <div className="col-4 col-md-2">
                    <label className="form-label">Sets</label>
                    <input className="form-control" type="number" min={1} value={(it as SingleItem).sets ?? ""} onChange={(e) => updateSingle("warmup", idx, { sets: Number(e.target.value) || undefined })} />
                  </div>
                  <div className="col-8 col-md-3">
                    <label className="form-label">Reps</label>
                    <input className="form-control" value={(it as SingleItem).reps ?? ""} onChange={(e) => updateSingle("warmup", idx, { reps: e.target.value })} placeholder="e.g., 10 or 10-8-6" />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label">Weight (kg)</label>
                    <input className="form-control" type="number" min={0} value={(it as SingleItem).weight_kg ?? ""} onChange={(e) => updateSingle("warmup", idx, { weight_kg: Number(e.target.value) || null })} />
                  </div>
                  <div className="col-6 col-md-1">
                    <label className="form-label">Rest (s)</label>
                    <input className="form-control" type="number" min={0} value={(it as SingleItem).rest_s ?? ""} onChange={(e) => updateSingle("warmup", idx, { rest_s: Number(e.target.value) || null })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Superset name</label>
                    <input className="form-control" value={(it as SupersetItem).name ?? ""} onChange={(e) => updateSuperset("warmup", idx, { name: e.target.value })} />
                  </div>
                  {((it as SupersetItem).items || []).map((s, sidx) => (
                    <div key={`${idx}-${sidx}`} className="col-12 col-md-8">
                      <div className="row g-2">
                        <div className="col-6">
                          <label className="form-label">Exercise</label>
                          <select className="form-select" value={s.exercise_id} onChange={(e) => setSupersetExercise("warmup", idx, sidx, e.target.value)}>
                            <option value="">— Select —</option>
                            {exercises.map((e: any) => <option key={e.id} value={e.id}>{e.exercise_name} {e.type ? `• ${e.type}` : ""}</option>)}
                          </select>
                        </div>
                        <div className="col-3">
                          <label className="form-label">Reps</label>
                          <input className="form-control" value={s.reps ?? ""} onChange={(e) => {
                            const ss = it as SupersetItem;
                            const newItems = [...ss.items]; newItems[sidx] = { ...newItems[sidx], reps: e.target.value };
                            updateSuperset("warmup", idx, { items: newItems });
                          }} />
                        </div>
                        <div className="col-3">
                          <label className="form-label">Weight (kg)</label>
                          <input className="form-control" type="number" min={0} value={s.weight_kg ?? ""} onChange={(e) => {
                            const ss = it as SupersetItem;
                            const newItems = [...ss.items]; newItems[sidx] = { ...newItems[sidx], weight_kg: Number(e.target.value) || null };
                            updateSuperset("warmup", idx, { items: newItems });
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )) : <div className="small text-dim">Add warm-up items.</div>}
        </section>

        {/* Main */}
        <section className="bxkr-card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Main Set</h6>
            <div className="d-flex gap-2">
              <button className="btn btn-sm" style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }} onClick={() => addSingle("main")}>+ Single</button>
              <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }} onClick={() => addSuperset("main")}>+ Superset</button>
            </div>
          </div>
          {main.items.length ? main.items.map((it, idx) => (
            <div key={`main-${idx}`} className="row g-2 mb-2">
              {/* Same inputs as warmup, but mapped to main */}
              {it.type === "Single" ? (
                <>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Exercise</label>
                    <select className="form-select" value={(it as SingleItem).exercise_id}
                            onChange={(e) => updateSingle("main", idx, { exercise_id: e.target.value })}>
                      <option value="">— Select —</option>
                      {exercises.map((e: any) => <option key={e.id} value={e.id}>{e.exercise_name} {e.type ? `• ${e.type}` : ""}</option>)}
                    </select>
                  </div>
                  <div className="col-4 col-md-2">
                    <label className="form-label">Sets</label>
                    <input className="form-control" type="number" min={1} value={(it as SingleItem).sets ?? ""} onChange={(e) => updateSingle("main", idx, { sets: Number(e.target.value) || undefined })} />
                  </div>
                  <div className="col-8 col-md-3">
                    <label className="form-label">Reps</label>
                    <input className="form-control" value={(it as SingleItem).reps ?? ""} onChange={(e) => updateSingle("main", idx, { reps: e.target.value })} />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label">Weight (kg)</label>
                    <input className="form-control" type="number" min={0} value={(it as SingleItem).weight_kg ?? ""} onChange={(e) => updateSingle("main", idx, { weight_kg: Number(e.target.value) || null })} />
                  </div>
                  <div className="col-6 col-md-1">
                    <label className="form-label">Rest (s)</label>
                    <input className="form-control" type="number" min={0} value={(it as SingleItem).rest_s ?? ""} onChange={(e) => updateSingle("main", idx, { rest_s: Number(e.target.value) || null })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Superset name</label>
                    <input className="form-control" value={(it as SupersetItem).name ?? ""} onChange={(e) => updateSuperset("main", idx, { name: e.target.value })} />
                  </div>
                  {((it as SupersetItem).items || []).map((s, sidx) => (
                    <div key={`${idx}-${sidx}`} className="col-12 col-md-8">
                      <div className="row g-2">
                        <div className="col-6">
                          <label className="form-label">Exercise</label>
                          <select className="form-select" value={s.exercise_id} onChange={(e) => setSupersetExercise("main", idx, sidx, e.target.value)}>
                            <option value="">— Select —</option>
                            {exercises.map((e: any) => <option key={e.id} value={e.id}>{e.exercise_name} {e.type ? `• ${e.type}` : ""}</option>)}
                          </select>
                        </div>
                        <div className="col-3">
                          <label className="form-label">Reps</label>
                          <input className="form-control" value={s.reps ?? ""} onChange={(e) => {
                            const ss = it as SupersetItem;
                            const newItems = [...ss.items]; newItems[sidx] = { ...newItems[sidx], reps: e.target.value };
                            updateSuperset("main", idx, { items: newItems });
                          }} />
                        </div>
                        <div className="col-3">
                          <label className="form-label">Weight (kg)</label>
                          <input className="form-control" type="number" min={0} value={s.weight_kg ?? ""} onChange={(e) => {
                            const ss = it as SupersetItem;
                            const newItems = [...ss.items]; newItems[sidx] = { ...newItems[sidx], weight_kg: Number(e.target.value) || null };
                            updateSuperset("main", idx, { items: newItems });
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )) : <div className="small text-dim">Add main set items.</div>}
        </section>

        {/* Finisher */}
        <section className="bxkr-card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Finisher</h6>
            <div className="d-flex gap-2">
              <button className="btn btn-sm" style={{ background: ACCENT, color: "#0b0f14", borderRadius: 24 }} onClick={() => addSingle("finisher")}>+ Single</button>
              <button className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }} onClick={() => addSuperset("finisher")}>+ Superset</button>
            </div>
          </div>
          {!finisher?.items?.length ? <div className="small text-dim">Optional finisher.</div> : finisher.items.map((it, idx) => (
            <div key={`fin-${idx}`} className="row g-2 mb-2">
              {/* same inputs as warmup but mapped to finisher */}
              {/* You can refactor into a subcomponent if you like */}
              {it.type === "Single" ? (
                <>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Exercise</label>
                    <select className="form-select" value={(it as SingleItem).exercise_id}
                            onChange={(e) => updateSingle("finisher", idx, { exercise_id: e.target.value })}>
                      <option value="">— Select —</option>
                      {exercises.map((e: any) => <option key={e.id} value={e.id}>{e.exercise_name} {e.type ? `• ${e.type}` : ""}</option>)}
                    </select>
                  </div>
                  <div className="col-4 col-md-2">
                    <label className="form-label">Sets</label>
                    <input className="form-control" type="number" min={1} value={(it as SingleItem).sets ?? ""} onChange={(e) => updateSingle("finisher", idx, { sets: Number(e.target.value) || undefined })} />
                  </div>
                  <div className="col-8 col-md-3">
                    <label className="form-label">Reps</label>
                    <input className="form-control" value={(it as SingleItem).reps ?? ""} onChange={(e) => updateSingle("finisher", idx, { reps: e.target.value })} />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label">Weight (kg)</label>
                    <input className="form-control" type="number" min={0} value={(it as SingleItem).weight_kg ?? ""} onChange={(e) => updateSingle("finisher", idx, { weight_kg: Number(e.target.value) || null })} />
                  </div>
                  <div className="col-6 col-md-1">
                    <label className="form-label">Rest (s)</label>
                    <input className="form-control" type="number" min={0} value={(it as SingleItem).rest_s ?? ""} onChange={(e) => updateSingle("finisher", idx, { rest_s: Number(e.target.value) || null })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Superset name</label>
                    <input className="form-control" value={(it as SupersetItem).name ?? ""} onChange={(e) => updateSuperset("finisher", idx, { name: e.target.value })} />
                  </div>
                  {((it as SupersetItem).items || []).map((s, sidx) => (
                    <div key={`${idx}-${sidx}`} className="col-12 col-md-8">
                      <div className="row g-2">
                        <div className="col-6">
                          <label className="form-label">Exercise</label>
                          <select className="form-select" value={s.exercise_id} onChange={(e) => setSupersetExercise("finisher", idx, sidx, e.target.value)}>
                            <option value="">— Select —</option>
                            {exercises.map((e: any) => <option key={e.id} value={e.id}>{e.exercise_name} {e.type ? `• ${e.type}` : ""}</option>)}
                          </select>
                        </div>
                        <div className="col-3">
                          <label className="form-label">Reps</label>
                          <input className="form-control" value={s.reps ?? ""} onChange={(e) => {
                            const ss = it as SupersetItem;
                            const newItems = [...ss.items]; newItems[sidx] = { ...newItems[sidx], reps: e.target.value };
                            updateSuperset("finisher", idx, { items: newItems });
                          }} />
                        </div>
                        <div className="col-3">
                          <label className="form-label">Weight (kg)</label>
                          <input className="form-control" type="number" min={0} value={s.weight_kg ?? ""} onChange={(e) => {
                            const ss = it as SupersetItem;
                            const newItems = [...ss.items]; newItems[sidx] = { ...newItems[sidx], weight_kg: Number(e.target.value) || null };
                            updateSuperset("finisher", idx, { items: newItems });
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
        </section>

        <button
          className="btn btn-primary w-100 mt-2"
          onClick={save}
          disabled={saving}
          style={{ borderRadius: 24, background: ACCENT, border: "none" }}
        >
          {saving ? "Saving…" : "Create Gym Workout          {saving ? "Saving…" : "Create Gym Workout"}
        </button>
      </main>
      <BottomNav />
    </>
  );
}
