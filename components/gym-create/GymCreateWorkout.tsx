// components/gym-create/GymCreateWorkout.tsx
import { useState } from "react";
import RoundEditor from "./RoundEditor";

export default function GymCreateWorkout() {
  const [workout, setWorkout] = useState<any>({
    workout_name: "",
    visibility: "private",
    main: { name: "Main", items: [] },
  });

  function updateRound(roundKey: "warmup" | "main" | "finisher", value: any) {
    setWorkout((w: any) => ({ ...w, [roundKey]: value }));
  }

  async function submit() {
    const res = await fetch("/api/workouts/gym-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workout),
    });

    const json = await res.json();
    if (!res.ok) alert(json.error || "Failed");
    else alert("Workout created");
  }

  return (
    <div>
      <h2>Create Gym Workout</h2>

      <input
        value={workout.workout_name}
        onChange={(e) => setWorkout({ ...workout, workout_name: e.target.value })}
        placeholder="Workout name"
      />

      <RoundEditor
        title="Main"
        value={workout.main}
        onChange={(v) => updateRound("main", v)}
      />

      <button onClick={submit}>Save workout</button>
    </div>
  );
}
