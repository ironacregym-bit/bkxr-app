"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useState } from "react";
import BottomNav from "../../../components/BottomNav";

import ProgramMetaStep from "../../../components/program-create/ProgramMetaStep";
import ProgramScheduleStep, {
  ProgramScheduleItem,
} from "../../../components/program-create/ProgramScheduleStep";
import ProgramProgressionStep from "../../../components/program-create/ProgramProgressionStep";
import ProgramReviewStep from "../../../components/program-create/ProgramReviewStep";

export type ProgramDraft = {
  name: string;
  start_date: string;
  weeks: number;
  assigned_to: string[];
  schedule: ProgramScheduleItem[];
  week_overrides: {
    [workout_id: string]: {
      weeks: {
        [week: number]: {
          percent_1rm?: number | null;
        };
      };
    };
  };
};

export default function CreateProgramPage() {
  // ✅ Hooks MUST be called unconditionally at the top level
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);

  const [program, setProgram] = useState<ProgramDraft>({
    name: "",
    start_date: "",
    weeks: 12,
    assigned_to: [],
    schedule: [],
    week_overrides: {},
  });

  async function createProgram() {
    try {
      setCreating(true);
      const res = await fetch("/api/programs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(program),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create program");
      alert("Program created ✅");
    } catch (e: any) {
      alert(e?.message || "Failed to create program");
    } finally {
      setCreating(false);
    }
  }

  // ✅ Now it’s safe to early-return (hooks already ran)
  if (status === "loading") {
    return <div className="container py-4">Checking access…</div>;
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access denied</h3>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Create Training Program • Admin</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <h2 className="mb-3">Create Training Program</h2>

        {step === 1 && (
          <ProgramMetaStep
            value={{
              name: program.name,
              start_date: program.start_date,
              weeks: program.weeks,
              assigned_to: program.assigned_to,
            }}
            onChange={(patch) => setProgram((p) => ({ ...p, ...patch }))}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <ProgramScheduleStep
            value={program.schedule}
            onChange={(schedule) => setProgram((p) => ({ ...p, schedule }))}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <ProgramProgressionStep
            weeks={program.weeks}
            schedule={program.schedule}
            value={program.week_overrides}
            onChange={(week_overrides) => setProgram((p) => ({ ...p, week_overrides }))}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <ProgramReviewStep
            program={{
              name: program.name,
              start_date: program.start_date,
              weeks: program.weeks,
              assigned_to: program.assigned_to,
            }}
            schedule={program.schedule}
            week_overrides={program.week_overrides}
            onBack={() => setStep(3)}
            onCreate={createProgram}
            creating={creating}
          />
        )}
      </main>

      <BottomNav />
    </>
  );
}
