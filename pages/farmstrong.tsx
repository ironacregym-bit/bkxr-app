import Head from "next/head";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import IronAcreHeader from "../components/iron-acre/IronAcreHeader";

const fetcher = (u: string) =>
  fetch(u).then((r) => r.json());

export default function FarmStrongPage() {
  const { data: session } = useSession();

  const [saving, setSaving] =
    useState<string>("");

  const { data: config } = useSWR(
    "/api/admin/farmstrong/get",
    fetcher
  );

  const {
    data: strengthProfile,
    mutate: mutateStrength,
  } = useSWR(
    "/api/strength/profile/get",
    fetcher
  );

  const activeBlock =
    config?.blocks?.find(
      (b: any) =>
        b.id === config?.activeBlockId
    ) || null;

  const lifts =
    activeBlock?.exercise_ids || [];

  const trainingMaxes =
    strengthProfile?.profile
      ?.training_maxes || {};

  async function updateLift(
    exerciseId: string,
    exerciseName: string
  ) {
    const current =
      trainingMaxes?.[exerciseName] || "";

    const value = prompt(
      `Update ${exerciseName}`,
      String(current)
    );

    if (!value) return;

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    try {
      setSaving(exerciseId);

      const res = await fetch(
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
            value: numericValue,
          }),
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(
          json?.error || "Failed"
        );
      }

      await mutateStrength();
    } catch (err: any) {
      alert(
        err?.message ||
          "Failed to save"
      );
    } finally {
      setSaving("");
    }
  }

  const exerciseLookup = useMemo(() => {
    const map = new Map();

    for (const ex of config?.exercises ||
      []) {
      map.set(ex.id, ex);
    }

    return map;
  }, [config]);

  return (
    <>
      <Head>
        <title>Farm Strong</title>
      </Head>

      <main className="container py-2 iron-acre-home ia-home-main">
        <IronAcreHeader
          userName={
            session?.user?.name ||
            "Athlete"
          }
          dateLabel="Farm Strong"
        />

        <section className="ia-tile ia-tile-pad mb-2">
          <div className="ia-kicker">
            <i className="fas fa-tractor" />
            FARM STRONG
          </div>

          <div className="ia-page-title">
            {activeBlock?.name ||
              "No Active Block"}
          </div>

          <div className="ia-page-subtitle">
            {activeBlock?.focus || ""}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-2">
          <div className="ia-card-title-compact">
            Focus Lifts
          </div>

          {lifts.length === 0 ? (
            <div className="text-dim small mt-2">
              No exercises configured.
            </div>
          ) : (
            <div className="mt-2">
              {lifts.map(
                (exerciseId: string) => {
                  const exercise =
                    exerciseLookup.get(
                      exerciseId
                    );

                  const exerciseName =
                    exercise
                      ?.exercise_name ||
                    exerciseId;

                  const currentValue =
                    trainingMaxes?.[
                      exerciseName
                    ] || 0;

                  return (
                    <div
                      key={exerciseId}
                      className="ia-strength-row"
                    >
                      <div>
                        <div className="ia-tile-title">
                          {exerciseName}
                        </div>

                        <div className="text-dim small">
                          Current best
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        <div className="ia-strength-value">
                          {currentValue > 0
                            ? `${currentValue}kg`
                            : "--"}
                        </div>

                        <button
                          className="ia-btn-outline"
                          disabled={
                            saving ===
                            exerciseId
                          }
                          onClick={() =>
                            updateLift(
                              exerciseId,
                              exerciseName
                            )
                          }
                        >
                          {saving ===
                          exerciseId
                            ? "Saving..."
                            : "Update"}
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}
