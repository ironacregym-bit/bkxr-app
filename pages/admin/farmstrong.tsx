import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import BottomNav from "../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Block = {
  id: string;
  name: string;
  focus?: string;
  description?: string;
  weeks?: number;
  program_id?: string;
  exercise_ids?: string[];
};

export default function FarmStrongAdminPage() {
  const { data: session, status } = useSession();

  const role = (session?.user as any)?.role || "user";

  const canAccess =
    !!session &&
    (role === "admin" || role === "gym");

  const { data, mutate } = useSWR(
    canAccess ? "/api/admin/farmstrong/get" : null,
    fetcher
  );

  const [editingId, setEditingId] = useState("");

  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const [description, setDescription] = useState("");
  const [weeks, setWeeks] = useState(8);
  const [programId, setProgramId] = useState("");
  const [exerciseIds, setExerciseIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function saveBlock() {
    try {
      setSaving(true);

      const r = await fetch("/api/admin/farmstrong/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          block_id: editingId,
          name,
          focus,
          description,
          weeks,
          program_id: programId,
          exercise_ids: exerciseIds,
        }),
      });

      const json = await r.json();

      if (!r.ok) {
        throw new Error(json?.error || "Failed");
      }

      setEditingId("");
      setName("");
      setFocus("");
      setDescription("");
      setWeeks(8);
      setProgramId("");
      setExerciseIds([]);

      mutate();
    } catch (err: any) {
      alert(err?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function activateBlock(id: string) {
    const r = await fetch(
      "/api/admin/farmstrong/set-active",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          block_id: id,
        }),
      }
    );

    if (r.ok) {
      mutate();
    }
  }

  if (status === "loading") {
    return (
      <main className="container py-3">
        Loading...
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="container py-3">
        Access denied
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Farm Strong Admin</title>
      </Head>

      <main
        className="container py-3"
        style={{
          color: "#fff",
          paddingBottom: 100,
        }}
      >
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <div className="ia-kicker">
                <i className="fas fa-tractor" />
                Farm Strong
              </div>

              <div className="ia-page-title">
                Block Builder
              </div>

              <div className="ia-page-subtitle">
                Manage active blocks and tracked
                exercises.
              </div>
            </div>

            /admin
              Back
            </Link>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-card-title-compact">
            Active Block
          </div>

          <div className="mt-2">
            <strong>
              {data?.blocks?.find(
                (b: Block) =>
                  b.id === data?.activeBlockId
              )?.name || "None Selected"}
            </strong>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-card-title-compact">
            {editingId
              ? "Edit Block"
              : "Create Block"}
          </div>

          <div className="mt-3">
            <label className="form-label">
              Block Name
            </label>

            <input
              className="form-control"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
            />
          </div>

          <div className="mt-3">
            <label className="form-label">
              Focus
            </label>

            <input
              className="form-control"
              value={focus}
              onChange={(e) =>
                setFocus(e.target.value)
              }
            />
          </div>

          <div className="mt-3">
            <label className="form-label">
              Description
            </label>

            <textarea
              className="form-control"
              rows={4}
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
            />
          </div>

          <div className="mt-3">
            <label className="form-label">
              Weeks
            </label>

            <input
              type="number"
              min={1}
              className="form-control"
              value={weeks}
              onChange={(e) =>
                setWeeks(Number(e.target.value))
              }
            />
          </div>

          <div className="mt-3">
            <label className="form-label">
              Linked Program
            </label>

            <select
              className="form-select"
              value={programId}
              onChange={(e) =>
                setProgramId(e.target.value)
              }
            >
              <option value="">
                Select Program
              </option>

              {(data?.programs || []).map(
                (p: any) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.name ||
                      p.title ||
                      p.program_id}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="mt-4">
            <div className="fw-bold mb-2">
              Tracked Exercises
            </div>

            <div
              style={{
                maxHeight: 350,
                overflowY: "auto",
              }}
            >
              {(data?.exercises || []).map(
                (exercise: any) => (
                  <label
                    key={exercise.id}
                    className="d-block mb-2"
                  >
                    <input
                      type="checkbox"
                      checked={exerciseIds.includes(
                        exercise.id
                      )}
                      onChange={(e) => {
                        if (
                          e.target.checked
                        ) {
                          setExerciseIds([
                            ...exerciseIds,
                            exercise.id,
                          ]);
                        } else {
                          setExerciseIds(
                            exerciseIds.filter(
                              (x) =>
                                x !==
                                exercise.id
                            )
                          );
                        }
                      }}
                    />

                    <span
                      style={{
                        marginLeft: 10,
                      }}
                    >
                      {exercise.exercise_name ||
                        exercise.id}
                    </span>
                  </label>
                )
              )}
            </div>
          </div>

          <div className="mt-4">
            <button
              className="ia-btn"
              disabled={saving}
              onClick={saveBlock}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Block"
                : "Create Block"}
            </button>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad">
          <div className="ia-card-title-compact">
            Existing Blocks
          </div>

          {(data?.blocks || []).map(
            (block: Block) => (
              <div
                key={block.id}
                className="mt-3 p-3"
                style={{
                  border:
                    "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                }}
              >
                <div className="d-flex justify-content-between">
                  <div>
                    <div className="fw-bold">
                      {block.name}
                    </div>

                    <div className="small text-dim">
                      {block.focus}
                    </div>

                    <div className="small text-dim">
                      {block.weeks} weeks
                    </div>
                  </div>

                  {data?.activeBlockId ===
                    block.id && (
                    <span
                      className="badge bg-success"
                    >
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="mt-3 d-flex gap-2">
                  <button
                    className="btn btn-outline-light btn-sm"
                    onClick={() => {
                      setEditingId(
                        block.id
                      );

                      setName(
                        block.name || ""
                      );

                      setFocus(
                        block.focus || ""
                      );

                      setDescription(
                        block.description ||
                          ""
                      );

                      setWeeks(
                        block.weeks || 8
                      );

                      setProgramId(
                        block.program_id ||
                          ""
                      );

                      setExerciseIds(
                        block.exercise_ids ||
                          []
                      );
                    }}
                  >
                    Edit
                  </button>

                  <button
                    className="btn btn-success btn-sm"
                    onClick={() =>
                      activateBlock(
                        block.id
                      )
                    }
                  >
                    Activate
                  </button>
                </div>
              </div>
            )
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}
