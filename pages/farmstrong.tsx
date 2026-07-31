import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../components/BottomNav";

import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export default function FarmStrongPage() {
  const { data: session, status } = useSession();

  const [selectedLift, setSelectedLift] =
    useState("");

  const [newValue, setNewValue] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [emailValue, setEmailValue] =
    useState("");

  const { data, mutate } = useSWR(
    status === "authenticated"
      ? "/api/farmstrong/dashboard"
      : null,
    fetcher
  );

  const activeBlock =
    data?.activeBlock || null;

  const lifts = data?.lifts || [];

  useEffect(() => {
    if (
      !selectedLift &&
      lifts.length > 0
    ) {
      setSelectedLift(
        lifts[0].exerciseId
      );
    }
  }, [lifts, selectedLift]);

  const selected =
    lifts.find(
      (x: any) =>
        x.exerciseId === selectedLift
    ) || null;

  const weightChart = useMemo(() => {
    const rows =
      data?.weightHistory || [];

    if (!rows.length) return null;

    return {
      data: {
        labels: rows.map((x: any) =>
          shortDate(x.date)
        ),
        datasets: [
          {
            label: "Weight",
            data: rows.map(
              (x: any) => x.weight_kg
            ),
            borderColor: "#18ff9a",
            backgroundColor:
              "rgba(24,255,154,.12)",
            tension: 0.35,
            pointRadius: 2,
            fill: true,
          } as ChartDataset<"line">,
        ],
      } as ChartData<"line">,

      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            ticks: {
              color: "#9fb0c3",
            },
            grid: {
              color:
                "rgba(255,255,255,.06)",
            },
          },
          y: {
            ticks: {
              color: "#9fb0c3",
            },
            grid: {
              color:
                "rgba(255,255,255,.06)",
            },
          },
        },
      } as ChartOptions<"line">,
    };
  }, [data]);

  const liftChart = useMemo(() => {
    if (!selected?.history?.length)
      return null;

    return {
      data: {
        labels:
          selected.history.map(
            (x: any) =>
              shortDate(
                x.recorded_at
              )
          ),

        datasets: [
          {
            label:
              selected.exerciseName,
            data:
              selected.history.map(
                (x: any) =>
                  x.value
              ),
            borderColor:
              "#18ff9a",
            backgroundColor:
              "rgba(24,255,154,.12)",
            tension: 0.35,
            fill: true,
          } as ChartDataset<"line">,
        ],
      } as ChartData<"line">,

      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
      } as ChartOptions<"line">,
    };
  }, [selected]);

  async function saveLift() {
    if (!selected) return;

    const value =
      Number(newValue);

    if (
      !Number.isFinite(value)
    )
      return;

    setSaving(true);

    try {
      const res = await fetch(
        "/api/farmstrong/update-lift",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            exercise_id:
              selected.exerciseId,
            exercise_name:
              selected.exerciseName,
            value,
          }),
        }
      );

      const json =
        await res.json();

      if (!res.ok) {
        throw new Error(
          json?.error ||
            "Failed"
        );
      }

      setNewValue("");

      await mutate();
    } catch (err: any) {
      alert(
        err?.message ||
          "Failed"
      );
    } finally {
      setSaving(false);
    }
  }

  async function emailLogin() {
    if (!emailValue) return;

    await signIn("email", {
      email: emailValue,
      callbackUrl:
        "/farmstrong",
    });
  }

  if (
    status === "loading"
  ) {
    return null;
  }

  return (
    <>
      <Head>
        <title>
          Farm Strong
        </title>
      </Head>

      {!session && (
        <div className="ia-modal-backdrop">
          <div
            className="ia-modal-card"
            style={{
              maxWidth: 460,
            }}
          >
            <div className="ia-kicker">
              <i className="fas fa-tractor" />
              FARM STRONG
            </div>

            <div className="ia-page-title mt-2">
              Member Login
            </div>

            <div className="ia-page-subtitle mt-2">
              Access your block,
              progress and
              tracked lifts.
            </div>

            <button
              className="ia-btn-primary w-100 mt-3"
              onClick={() =>
                signIn("google", {
                  callbackUrl:
                    "/farmstrong",
                })
              }
            >
              <i className="fab fa-google" />
              Continue with
              Google
            </button>

            <input
              className="form-control mt-3"
              placeholder="Email Address"
              value={emailValue}
              onChange={(e) =>
                setEmailValue(
                  e.target.value
                )
              }
            />

            <button
              className="ia-btn-outline w-100 mt-2"
              onClick={
                emailLogin
              }
            >
              Email me a
              sign in link
            </button>
          </div>
        </div>
      )}

      {session && (
        <main className="container py-2 iron-acre-home">
          <section className="ia-tile ia-tile-pad mb-2">
            <div className="ia-kicker">
              <i className="fas fa-tractor" />
              FARM STRONG
            </div>

            <div className="ia-page-title">
              {activeBlock?.name ||
                "Farm Strong"}
            </div>

            <div className="ia-page-subtitle">
              {activeBlock?.focus ||
                ""}
            </div>
          </section>

          <section className="ia-tile ia-tile-pad mb-2">
            <div className="ia-card-title-compact">
              Weight Progress
            </div>

            <div
              style={{
                height: 220,
                marginTop: 12,
              }}
            >
              {weightChart && (
                <Line
                  data={
                    weightChart.data
                  }
                  options={
                    weightChart.options
                  }
                />
              )}
            </div>
          </section>

          <section className="ia-tile ia-tile-pad mb-2">
            <div className="ia-card-title-compact">
              Featured Lifts
            </div>

            <div className="row g-2 mt-1">
              {lifts
                .slice(0, 4)
                .map(
                  (
                    lift: any
                  ) => (
                    <div
                      key={
                        lift.exerciseId
                      }
                      className="col-6"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLift(
                            lift.exerciseId
                          )
                        }
                        style={{
                          width:
                            "100%",
                          border:
                            "none",
                          background:
                            "transparent",
                          padding: 0,
                        }}
                      >
                        <div className="ia-task-card">
                          <div className="ia-task-card__main">
                            <div className="ia-task-card__title">
                              {
                                lift.exerciseName
                              }
                            </div>

                            <div className="ia-strength-value mt-2">
                              {
                                lift.current
                              }
                              kg
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  )
                )}
            </div>
          </section>

          <section className="ia-tile ia-tile-pad mb-2">
            <div className="ia-card-title-compact">
              Movements
            </div>

            <div
              className="ia-week-chip-row mt-2"
              style={{
                overflowX:
                  "auto",
                scrollbarWidth:
                  "thin",
                WebkitOverflowScrolling:
                  "touch",
              }}
            >
              {lifts.map(
                (
                  lift: any
                ) => (
                  <button
                    key={
                      lift.exerciseId
                    }
                    className={
                      selectedLift ===
                      lift.exerciseId
                        ? "ia-week-chip ia-week-chip-active"
                        : "ia-week-chip"
                    }
                    onClick={() =>
                      setSelectedLift(
                        lift.exerciseId
                      )
                    }
                  >
                    {
                      lift.exerciseName
                    }
                  </button>
                )
              )}
            </div>
          </section>

          {selected && (
            <section className="ia-tile ia-tile-pad mb-2">
              <div className="ia-card-title-compact">
                {
                  selected.exerciseName
                }
              </div>

              <div className="row g-2 mt-2">
                <div className="col-6">
                  <div className="ia-stat-mini">
                    <div className="ia-stat-mini-value">
                      {
                        selected.current
                      }
                      kg
                    </div>
                    <div className="ia-stat-mini-label">
                      Current
                    </div>
                  </div>
                </div>

                <div className="col-6">
                  <div className="ia-stat-mini">
                    <div className="ia-stat-mini-value">
                      {
                        selected.best
                      }
                      kg
                    </div>
                    <div className="ia-stat-mini-label">
                      Best Ever
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  height: 280,
                  marginTop: 16,
                }}
              >
                {liftChart && (
                  <Line
                    data={
                      liftChart.data
                    }
                    options={
                      liftChart.options
                    }
                  />
                )}
              </div>

              <div className="mt-3">
                <label className="form-label">
                  Update Lift
                </label>

                <input
                  type="number"
                  step="0.5"
                  className="form-control"
                  value={newValue}
                  onChange={(
                    e
                  ) =>
                    setNewValue(
                      e.target
                        .value
                    )
                  }
                  placeholder="New best"
                />
              </div>

              <button
                className="ia-btn-primary mt-3"
                disabled={
                  saving
                }
                onClick={
                  saveLift
                }
              >
                {saving
                  ? "Saving..."
                  : "Save Lift"}
              </button>
            </section>
          )}
        </main>
      )}

      <BottomNav />
    </>
  );
}
