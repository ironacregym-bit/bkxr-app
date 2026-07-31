import Head from "next/head";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import BottomNav from "../components/BottomNav";
import IronAcreHeader from "../components/iron-acre/IronAcreHeader";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function FarmStrongPage() {
  const { data: session } = useSession();

  const [selectedLift, setSelectedLift] = useState("");
  const [newLiftValue, setNewLiftValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: farmData } = useSWR(
    "/api/admin/farmstrong/get",
    fetcher
  );

  const {
    data: strengthProfile,
    mutate: mutateStrength,
  } = useSWR("/api/strength/profile/get", fetcher);

  const { data: checkins } = useSWR(
    "/api/checkins/series?limit=52",
    fetcher
  );

  const activeBlock = useMemo(() => {
    return (
      farmData?.blocks?.find(
        (b: any) => b.id === farmData?.activeBlockId
      ) || null
    );
  }, [farmData]);

  const exerciseLookup = useMemo(() => {
    const map = new Map<string, any>();

    for (const ex of farmData?.exercises || []) {
      map.set(ex.id, ex);
    }

    return map;
  }, [farmData]);

  const lifts = activeBlock?.exercise_ids || [];

  useEffect(() => {
    if (!selectedLift && lifts.length) {
      setSelectedLift(lifts[0]);
    }
  }, [lifts, selectedLift]);

  const featuredLifts = useMemo(() => {
    return lifts.slice(0, 4);
  }, [lifts]);

  const selectedExercise =
    exerciseLookup.get(selectedLift);

  const trainingMaxes =
    strengthProfile?.profile?.training_maxes || {};

  const true1Rms =
    strengthProfile?.profile?.true_1rms || {};

  const selectedCurrent =
    trainingMaxes?.[
      selectedExercise?.exercise_name || ""
    ] || 0;

  const selectedBest =
    true1Rms?.[
      selectedExercise?.exercise_name || ""
    ] || 0;

  const latestWeight =
    checkins?.results?.[0]?.weight_kg || null;

  const previousWeight =
    checkins?.results?.[1]?.weight_kg || null;

  const weightChange =
    latestWeight != null &&
    previousWeight != null
      ? latestWeight - previousWeight
      : null;

  async function saveLift() {
    if (!selectedLift) return;

    const exerciseName =
      selectedExercise?.exercise_name;

    const value = Number(newLiftValue);

    if (!exerciseName) return;

    if (!Number.isFinite(value)) {
      alert("Enter a valid number");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        "/api/farmstrong/update-lift",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            exercise_id: selectedLift,
            exercise_name: exerciseName,
            value,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.error || "Failed"
        );
      }

      setNewLiftValue("");

      await mutateStrength();
    } catch (err: any) {
      alert(
        err?.message ||
          "Failed to update"
      );
    } finally {
      setSaving(false);
    }
  }

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
            Weight Progress
          </div>

          <div
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              marginTop: 8,
            }}
          >
            {latestWeight
              ? `${latestWeight}kg`
              : "--"}
          </div>

          <div className="text-dim small">
            {weightChange != null
              ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(
                  1
                )}kg since last check-in`
              : "Waiting for more check-ins"}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-2">
          <div className="ia-card-title-compact">
            Featured Lifts
          </div>

          <div className="row g-2 mt-2">
            {featuredLifts.map(
              (exerciseId: string) => {
                const exercise =
                  exerciseLookup.get(
                    exerciseId
                  );

                const current =
                  trainingMaxes?.[
                    exercise?.exercise_name
                  ] || 0;

                return (
                  <div
                    className="col-6"
                    key={exerciseId}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedLift(
                          exerciseId
                        )
                      }
                      style={{
                        padding: 0,
                        border: "none",
                        background:
                          "transparent",
                        width: "100%",
                      }}
                    >
                      <div className="ia-task-card">
                        <div className="ia-task-card__main">
                          <div className="ia-task-card__title">
                            {
                              exercise?.exercise_name
                            }
                          </div>

                          <div
                            className="ia-strength-value"
                            style={{
                              marginTop: 8,
                            }}
                          >
                            {current > 0
                              ? `${current}kg`
                              : "--"}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              }
            )}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-2">
          <div className="ia-card-title-compact">
            All Movements
          </div>

          <div className="ia-week-chip-row mt-2">
            {lifts.map(
              (exerciseId: string) => {
                const exercise =
                  exerciseLookup.get(
                    exerciseId
                  );

                return (
                  <button
                    key={exerciseId}
                    type="button"
                    className={
                      selectedLift ===
                      exerciseId
                        ? "ia-week-chip ia-week-chip-active"
                        : "ia-week-chip"
                    }
                    onClick={() =>
                      setSelectedLift(
                        exerciseId
                      )
                    }
                  >
                    {
                      exercise?.exercise_name
                    }
                  </button>
                );
              }
            )}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-2">
          <div className="ia-card-title-compact">
            {selectedExercise
              ?.exercise_name ||
              "Select Movement"}
          </div>

          <div className="row g-2 mt-2">
            <div className="col-6">
              <div className="ia-stat-mini">
                <div className="ia-stat-mini-value">
                  {selectedCurrent > 0
                    ? `${selectedCurrent}kg`
                    : "--"}
                </div>

                <div className="ia-stat-mini-label">
                  Current
                </div>
              </div>
            </div>

            <div className="col-6">
              <div className="ia-stat-mini">
                <div className="ia-stat-mini-value">
                  {selectedBest > 0
                    ? `${selectedBest}kg`
                    : "--"}
                </div>

                <div className="ia-stat-mini-label">
                  Best Ever
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label className="form-label">
              Update Lift
            </label>

            <input
              type="number"
              step="0.5"
              className="form-control"
              value={newLiftValue}
              onChange={(e) =>
                setNewLiftValue(
                  e.target.value
                )
              }
              placeholder="Enter new best"
            />
          </div>

          <div className="mt-3">
            <button
              className="ia-btn-primary"
              disabled={
                saving ||
                !selectedLift
              }
              onClick={saveLift}
            >
              {saving
                ? "Saving..."
                : "Save Lift"}
            </button>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
