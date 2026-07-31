import Head from "next/head";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) =>
  fetch(u).then((r) => r.json());

export default function FarmStrongPage() {
  const { data: session } = useSession();

  const email = String(
    session?.user?.email || ""
  )
    .trim()
    .toLowerCase();

  const { data: config, mutate } =
    useSWR(
      email
        ? "/api/admin/farmstrong/get"
        : null,
      fetcher
    );

  const [saving, setSaving] =
    useState<string>("");

  const activeBlock =
    config?.blocks?.find(
      (x: any) =>
        x.id === config?.activeBlockId
    ) || null;

  async function updateLift(
    exerciseId: string,
    exerciseName: string
  ) {
    const value = prompt(
      `Enter new best for ${exerciseName}`
    );

    if (!value) return;

    setSaving(exerciseId);

    await fetch(
      "/api/farmstrong/update-lift",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          exercise_id: exerciseId,
          exercise_name: exerciseName,
          value: Number(value),
        }),
      }
    );

    setSaving("");

    mutate();
  }

  return (
    <>
      <Head>
        <title>Farm Strong</title>
      </Head>

      <main
        className="container py-3"
        style={{
          color: "#fff",
          paddingBottom: 100,
        }}
      >
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-kicker">
            <i className="fas fa-tractor" />
            Farm Strong
          </div>

          <div className="ia-page-title">
            {activeBlock?.name ||
              "No Active Block"}
          </div>

          <div className="ia-page-subtitle">
            {activeBlock?.focus || ""}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-card-title-compact">
            Current Focus
          </div>

          <div className="mt-3">
            {activeBlock?.exercise_ids?.map(
              (exerciseId: string) => {
                const exercise =
                  config?.exercises?.find(
                    (x: any) =>
                      x.id === exerciseId
                  );

                return (
                  <div
                    key={exerciseId}
                    className="p-3 mb-2"
                    style={{
                      border:
                        "1px solid rgba(255,255,255,.1)",
                      borderRadius: 12,
                    }}
                  >
                    <div className="fw-bold">
                      {exercise?.exercise_name ||
                        exerciseId}
                    </div>

                    <div className="small text-dim">
                      Track your current
                      best lift
                    </div>

                    <div className="mt-3">
                      <button
                        className="btn btn-success btn-sm"
                        disabled={
                          saving ===
                          exerciseId
                        }
                        onClick={() =>
                          updateLift(
                            exerciseId,
                            exercise?.exercise_name ||
                              exerciseId
                          )
                        }
                      >
                        {saving ===
                        exerciseId
                          ? "Saving..."
                          : "Update Lift"}
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
