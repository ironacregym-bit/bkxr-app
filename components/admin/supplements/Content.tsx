"use client";

type Supplement = {
  id: string;
  name: string;
  quantity?: string | null;
  brand?: string | null;
  link?: string | null;
  notes?: string | null;
  image_url?: string | null;
};

export default function SupplementsContent({
  supplements,
  onChange,
}: {
  supplements: Supplement[];
  onChange: () => void;
}) {
  async function update(id: string, patch: Partial<Supplement>) {
    await fetch(`/api/supplements/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    onChange();
  }

  async function remove(id: string) {
    if (!confirm("Delete this supplement?")) return;
    await fetch(`/api/supplements/${id}`, { method: "DELETE" });
    onChange();
  }

  async function create() {
    await fetch("/api/supplements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Supplement" }),
    });
    onChange();
  }

  return (
    <>
      <div className="d-flex justify-content-between mb-3">
        <h3>Supplements</h3>
        <button className="btn btn-success" onClick={create}>
          + Add
        </button>
      </div>

      {supplements.map((s) => (
        <div key={s.id} className="card mb-2 p-2 bg-dark text-white">
          <input
            className="form-control mb-1"
            defaultValue={s.name}
            onBlur={(e) => update(s.id, { name: e.target.value })}
          />

          <input
            className="form-control mb-1"
            placeholder="Brand"
            defaultValue={s.brand ?? ""}
            onBlur={(e) => update(s.id, { brand: e.target.value })}
          />

          <input
            className="form-control mb-1"
            placeholder="Quantity"
            defaultValue={s.quantity ?? ""}
            onBlur={(e) => update(s.id, { quantity: e.target.value })}
          />

          <input
            className="form-control mb-1"
            placeholder="Link"
            defaultValue={s.link ?? ""}
            onBlur={(e) => update(s.id, { link: e.target.value })}
          />

          <textarea
            className="form-control mb-2"
            placeholder="Notes"
            defaultValue={s.notes ?? ""}
            onBlur={(e) => update(s.id, { notes: e.target.value })}
          />

          <button className="btn btn-sm btn-danger" onClick={() => remove(s.id)}>
            Delete
          </button>
        </div>
      ))}
    </>
  );
}