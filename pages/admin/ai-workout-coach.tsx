import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import BottomNav from "../../components/BottomNav";

export default function AIWorkoutCoachPage() {
  const { data: session, status } = useSession();

  const role = (session?.user as any)?.role || "user";

  const canAccess =
    !!session &&
    (role === "admin" || role === "gym");

  const [classType, setClassType] =
    useState("Farm Strong");

  const [classSize, setClassSize] =
    useState(12);

  const [duration, setDuration] =
    useState(20);

  const [format, setFormat] =
    useState("");

  const [focus, setFocus] =
    useState("");

  const [equipmentNotes, setEquipmentNotes] =
    useState("");

  const [requirements, setRequirements] =
    useState("");

  const [result, setResult] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function generateWorkout() {
    try {
      setLoading(true);
      setResult("");

      const response = await fetch(
        "/api/ai/generate-workout",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            classType,
            classSize,
            duration,
            format,
            focus,
            equipmentNotes,
            requirements,
          }),
        }
      );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error || "Failed"
        );
      }

      setResult(
        json?.workout ||
          "No workout returned."
      );
    } catch (err: any) {
      alert(
        err?.message ||
          "Failed to generate workout"
      );
    } finally {
      setLoading(false);
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
        <title>
          AI Workout Coach
        </title>
      </Head>

      <main
        className="container py-3"
        style={{
          color: "#fff",
          paddingBottom: 120,
        }}
      >
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <div className="ia-kicker">
                <i className="fas fa-robot" /> AI
                Coach
              </div>

              <div className="ia-page-title">
                AI Workout Coach
              </div>

              <div className="ia-page-subtitle">
                Generate workouts
                using AI and your
                gym equipment.
              </div>
            </div>

            <Link href="/admin">
              Back
            </Link>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-card-title-compact">
            Workout Brief
          </div>

          <div className="mt-3">
            <label className="form-label">
              Class Type
            </label>

            <select
              className="form-select"
              value={classType}
              onChange={(e) =>
                setClassType(
                  e.target.value
                )
              }
            >
              <option>
                Farm Strong
              </option>
              <option>
                Strength
              </option>
              <option>
                Conditioning
              </option>
              <option>
                Hybrid
              </option>
              <option>
                Open Gym
              </option>
            </select>
          </div>

          <div className="mt-3">
            <label className="form-label">
              Class Size
            </label>

            <input
              type="number"
              min={1}
              className="form-control"
              value={classSize}
              onChange={(e) =>
                setClassSize(
                  Number(
                    e.target.value
                  )
                )
              }
            />
          </div>

          <div className="mt-3">
            <label className="form-label">
              Duration
              (Minutes)
            </label>

            <input
              type="number"
              min={5}
              className="form-control"
              value={duration}
              onChange={(e) =>
                setDuration(
                  Number(
                    e.target.value
                  )
                )
              }
            />
          </div>

          <div className="mt-3">
            <label className="form-label">
              Format
            </label>

            <select
              className="form-select"
              value={format}
              onChange={(e) =>
                setFormat(
                  e.target.value
                )
              }
            >
              <option value="">
                Select Format
              </option>
              <option>
                Individual
              </option>
              <option>
                Pairs
              </option>
              <option>
                Teams
              </option>
              <option>
                Stations
              </option>
              <option>
                Coach Chooses
              </option>
            </select>
          </div>

          <div className="mt-3">
            <label className="form-label">
              Focus
            </label>

            <select
              className="form-select"
              value={focus}
              onChange={(e) =>
                setFocus(
                  e.target.value
                )
              }
            >
              <option value="">
                Select Focus
              </option>
              <option>
                Strength
              </option>
              <option>
                Conditioning
              </option>
              <option>
                Strongman
              </option>
              <option>
                Hyrox
              </option>
              <option>Mixed</option>
            </select>
          </div>

          <div className="mt-3">
            <label className="form-label">
              Equipment Notes
            </label>

            <textarea
              rows={4}
              className="form-control"
              value={
                equipmentNotes
              }
              onChange={(e) =>
                setEquipmentNotes(
                  e.target.value
                )
              }
              placeholder="Available equipment..."
            />
          </div>

          <div className="mt-3">
            <label className="form-label">
              Special Requirements
            </label>

            <textarea
              rows={4}
              className="form-control"
              value={
                requirements
              }
              onChange={(e) =>
                setRequirements(
                  e.target.value
                )
              }
              placeholder="Anything specific..."
            />
          </div>

          <div className="mt-4">
            <button
              className="ia-btn"
              disabled={loading}
              onClick={
                generateWorkout
              }
            >
              {loading
                ? "Generating..."
                : "Generate Workout"}
            </button>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad">
          <div className="ia-card-title-compact">
            Generated Workout
          </div>

          <div
            className="mt-3"
            style={{
              whiteSpace:
                "pre-wrap",
              minHeight: 250,
            }}
          >
            {result ||
              "No workout generated yet."}
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
