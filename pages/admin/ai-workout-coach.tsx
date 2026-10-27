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
    useState<any>(null);

  const [draftId, setDraftId] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [approving, setApproving] =
    useState(false);

  const [activityLog, setActivityLog] =
  useState<string[]>([]);

  const [agentStage, setAgentStage] =
    useState("");

  function addActivity(
    message: string
  ) {
    setActivityLog((prev) => [
      ...prev,
      message,
    ]);
  }
  
  async function generateWorkout() {
    try {
      setLoading(true);
      setResult(null);
      setDraftId("");

      setActivityLog([]);
    
        setAgentStage(
          "Loading Agent"
        );
        
        addActivity(
          "Loading agent definition"
        );
        
        setTimeout(() => {
          setAgentStage(
            "Equipment"
          );
        
          addActivity(
            "Retrieving equipment"
          );
        }, 500);
        
        setTimeout(() => {
          setAgentStage(
            "Exercises"
          );
        
          addActivity(
            "Loading exercise library"
          );
        }, 1000);
        
        setTimeout(() => {
          setAgentStage(
            "History"
          );
        
          addActivity(
            "Checking previous workouts"
          );
        }, 1500);

          setTimeout(() => {
            setAgentStage(
              "Context"
            );
          
            addActivity(
              "Building workout context"
            );
          }, 2200);
          
          setTimeout(() => {
            setAgentStage(
              "Generation"
            );
          
            addActivity(
              "Generating workout"
            );
          }, 2800);
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

      setDraftId(
        json?.draftId || ""
      );

      addActivity(
        "Workout generated"
      );
      
      addActivity(
        `Draft saved (${json?.draftId})`
      );
      
      setAgentStage(
        "Complete"
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

  async function approveWorkout() {
    try {
      if (!draftId) {
        return;
      }

      setApproving(true);

      const response = await fetch(
        "/api/ai/approve-workout",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            draftId,
          }),
        }
      );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Approval failed"
        );
      }

      alert(
        "Workout approved and published."
      );

      setDraftId("");
    } catch (err: any) {
      alert(
        err?.message ||
          "Failed to approve workout"
      );
    } finally {
      setApproving(false);
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
                Agent-powered workout
                generation using
                equipment, workout
                history and approved
                exercises.
              </div>
            </div>

            <Link href="/admin">
              Back
            </Link>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-card-title-compact">
            🤖 AI Coach
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
              Duration (Minutes)
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
              <option>Pairs</option>
              <option>Teams</option>
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
              <option>Hyrox</option>
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
              placeholder="Optional additional equipment information..."
            />
          </div>

          <div className="mt-3">
            <label className="form-label">
              Special Requirements
            </label>

            <textarea
              rows={5}
              className="form-control"
              value={
                requirements
              }
              onChange={(e) =>
                setRequirements(
                  e.target.value
                )
              }
              placeholder="Competitive finish, partner workout, strongman focus, avoid sleds etc..."
            />
          </div>

          <div
            className="alert alert-dark mt-4"
          >
            Generate a
            {" "}
            {duration}
            {" "}
            minute
            {" "}
            {classType}
            {" "}
            session for
            {" "}
            {classSize}
            {" "}
            athletes
            {focus
              ? ` focused on ${focus}`
              : ""}
            {format
              ? ` in a ${format} format`
              : ""}.
          </div>
          <div className="mt-4">
            <button
              className="ia-btn"
              disabled={loading}
              onClick={generateWorkout}
            >
              🤖 Generate Workout
            </button>
          </div>
        </section>
        {loading && (
          <section className="ia-tile ia-tile-pad mb-3">
            <div className="d-flex align-items-center mb-4">
              <div
                className="spinner-border text-success me-3"
                style={{
                  width: 50,
                  height: 50,
                }}
              />
        
              <div>
                <h4 className="mb-1">
                  AI Coach Working
                </h4>
        
                <div
                  style={{
                    opacity: 0.75,
                  }}
                >
                  {agentStage}
                </div>
              </div>
            </div>
        
            {activityLog.map(
              (
                item,
                index
              ) => (
                <div
                  key={index}
                  className="mb-2"
                >
                  ✅ {item}
                </div>
              )
            )}
          </section>
        )}
        <section className="ia-tile ia-tile-pad">
          <div className="ia-card-title-compact">
            AI Generated Workout
          </div>
        
          {!result && (
            <div
              className="mt-3"
              style={{
                minHeight: 150,
              }}
            >
              No workout generated yet.
            </div>
          )}
        
          {result && (
            <div className="mt-3">
        
              <div className="mb-4">
                <h2>{result.title}</h2>
        
                <p
                  style={{
                    opacity: 0.8,
                  }}
                >
                  {result.overview}
                </p>
              </div>
        
              <div className="ia-tile p-3 mb-3">
                <h4>🔥 Warm Up</h4>
        
                {result.warmup?.map(
                  (
                    item: any,
                    index: number
                  ) => (
                    <div
                      key={index}
                      className="mb-2"
                    >
                      <strong>
                        {item.exercise}
                      </strong>
        
                      {item.instructions && (
                        <div>
                          {item.instructions}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
        
              <div className="ia-tile p-3 mb-3">
                <h4>💪 Strength</h4>
        
                {result.strength?.map(
                  (
                    item: any,
                    index: number
                  ) => (
                    <div
                      key={index}
                      className="mb-3"
                    >
                      <strong>
                        {item.exercise}
                      </strong>
        
                      {item.sets && (
                        <div>
                          Sets:
                          {" "}
                          {item.sets}
                        </div>
                      )}
        
                      {item.reps && (
                        <div>
                          Reps:
                          {" "}
                          {item.reps}
                        </div>
                      )}
        
                      {item.instructions && (
                        <div>
                          {item.instructions}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
        
              <div className="ia-tile p-3 mb-3">
                <h4>🏃 Conditioning</h4>
        
                {result.conditioning?.map(
                  (
                    item: any,
                    index: number
                  ) => (
                    <div
                      key={index}
                      className="mb-2"
                    >
                      <strong>
                        {item.exercise}
                      </strong>
        
                      {item.instructions && (
                        <div>
                          {item.instructions}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
        
              <div className="ia-tile p-3 mb-3">
                <h4>🎯 Core</h4>
        
                {result.core?.map(
                  (
                    item: any,
                    index: number
                  ) => (
                    <div
                      key={index}
                      className="mb-2"
                    >
                      <strong>
                        {item.exercise}
                      </strong>
        
                      {item.instructions && (
                        <div>
                          {item.instructions}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
        
              <div className="ia-tile p-3 mb-3">
                <h4>🧘 Cool Down</h4>
        
                {result.cooldown?.map(
                  (
                    item: any,
                    index: number
                  ) => (
                    <div
                      key={index}
                      className="mb-2"
                    >
                      <strong>
                        {item.exercise}
                      </strong>
        
                      {item.instructions && (
                        <div>
                          {item.instructions}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
        
              {result.coach_notes?.length >
                0 && (
                <div className="ia-tile p-3">
                  <h4>📝 Coach Notes</h4>
        
                  {result.coach_notes.map(
                    (
                      note: string,
                      index: number
                    ) => (
                      <div
                        key={index}
                        className="mb-2"
                      >
                        • {note}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
          {activityLog.length > 0 && (
            <div className="mt-4">
              <h5>
                Agent Activity
              </h5>
          
              {activityLog.map(
                (
                  item,
                  index
                ) => (
                  <div
                    key={index}
                    className="small mb-1"
                  >
                    ✅ {item}
                  </div>
                )
              )}
            </div>
          )}
          {draftId && (
            <div className="mt-4">
              <div className="small text-success mb-3">
                Draft Saved: {draftId}
              </div>
        
              <button
                className="btn btn-success"
                disabled={approving}
                onClick={approveWorkout}
              >
                {approving
                  ? "Publishing..."
                  : "Approve & Publish Workout"}
              </button>
              <button
                className="btn btn-outline-light ms-2"
                onClick={generateWorkout}
              >
                Regenerate
              </button>
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}
