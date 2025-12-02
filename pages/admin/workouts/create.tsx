
import Head from "next/head";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import BottomNav from "../../../components/BottomNav";

type Round = {
  type: "boxing" | "kettlebell";
  combos?: string[]; // For boxing rounds
  style?: "amrap" | "emom" | "ladder"; // For kettlebell rounds
  details?: string; // Description for kettlebell
};

export default function CreateWorkoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role || "user";

  const [workoutName, setWorkoutName] = useState("");
  const [notes, setNotes] = useState("");
  const [rounds, setRounds] = useState<Round[]>(
    Array.from({ length: 10 }, (_, i) => ({
      type: i < 5 ? "boxing" : "kettlebell",
      combos: i < 5 ? ["", "", ""] : undefined,
      style: i >= 5 ? "amrap" : undefined,
      details: i >= 5 ? "" : undefined,
    }))
  );
  const [statusMsg, setStatusMsg] = useState("");

  if (status === "loading") return <div className="container py-4">Checking access…</div>;
  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const updateCombo = (roundIndex: number, comboIndex: number, value: string) => {
    const newRounds = [...rounds];
    if (newRounds[roundIndex].combos) {
      newRounds[roundIndex].combos![comboIndex] = value;
    }
    setRounds(newRounds);
  };

  const updateStyle = (roundIndex: number, style: "amrap" | "emom" | "ladder") => {
    const newRounds = [...rounds];
    newRounds[roundIndex].style = style;
    setRounds(newRounds);
  };

  const updateDetails = (roundIndex: number, value: string) => {
    const newRounds = [...rounds];
    newRounds[roundIndex].details = value;
    setRounds(newRounds);
  };

  const saveWorkout = async () => {
    setStatusMsg("Saving workout...");
    try {
      const res = await fetch("/api/workouts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workout_name: workoutName, notes, rounds }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatusMsg("Workout created successfully!");
        setTimeout(() => router.push("/admin"), 1500);
      } else {
        setStatusMsg(`Error: ${data.error || "Failed to create workout"}`);
      }
    } catch (e: any) {
      setStatusMsg(`Error: ${e?.message || "Network error"}`);
    }
  };

  return (
    <>
      <Head>
        <title>Create Workout - BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <main className="container py-3" style={{ paddingBottom: "70px" }}>
        <div className="mb-3">
          <button className="btn btn-outline-secondary mb-3" onClick={() => router.push("/admin")}>
            ← Back to Admin Dashboard
          </button>
        </div>
        <h2 className="mb-4 text-center">Create Workout</h2>

        {statusMsg && (
          <div className={`alert ${statusMsg.startsWith("Error") ? "alert-danger" : "alert-info"}`}>
            {statusMsg}
          </div>
        )}

        <div className="mb-3">
          <label className="form-label">Workout Name</label>
          <input
            className="form-control"
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            placeholder="Enter workout name"
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Notes</label>
          <textarea
            className="form-control"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
          />
        </div>

        <h4 className="mb-3">Rounds</h4>
        {rounds.map((round, i) => (
          <div key={i} className="card p-3 mb-3">
            <h6 className="fw-bold mb-2">
              Round {i + 1} ({round.type === "boxing" ? "Boxing" : "Kettlebell"})
            </h6>
            {round.type === "boxing" ? (
              <div>
                {round.combos!.map((combo, idx) => (
                  <div className="mb-2" key={idx}>
                    <input
                      className="form-control"
                      value={combo}
                      onChange={(e) => updateCombo(i, idx, e.target.value)}
                      placeholder={`Combo ${idx + 1}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div className="mb-2">
                  <label className="form-label">Style</label>
                  <select
                    className="form-select"
                    value={round.style}
                    onChange={(e) => updateStyle(i, e.target.value as "amrap" | "emom" | "ladder")}
                  >
                    <option value="amrap">AMRAP</option>
                    <option value="emom">EMOM</option>
                    <option value="ladder">Ladder</option>
                  </select>
                </div>
                <div className="mb-2">
                  <label className="form-label">Details</label>
                  <textarea
                    className="form-control"
                    value={round.details}
                    onChange={(e) => updateDetails(i, e.target.value)}
                    placeholder="Describe the kettlebell workout"
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <button className="btn btn-primary w-100 mt-3" onClick={saveWorkout}>
          Save Workout
        </button>
      </main>
      <BottomNav />
    </>
  );
}
