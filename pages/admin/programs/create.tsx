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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(json?.error || "Request failed");
  return json as T;
}

export default function CreateProgramPage() {
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
      await postJson<{ ok?: boolean; program_id?: string }>("/api/programs/create", program);
      alert("Program created ✅");
    } catch (e: any) {
      alert(e?.message || "Failed to create program");
    } finally {
      setCreating(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="container py-4 text-white">
        <div className="ia-tile ia-tile-pad">
          <div className="text-dim">Checking access…</div>
        </div>
      </div>
    );
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4 text-white">
        <div className="ia-tile ia-tile-pad">
          <div className="ia-page-title">Access denied</div>
          <div className="text-dim">You do not have permission to view this page.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Create Training Program • Admin</title>
      </Head>

      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        <div className="ia-page-title">Create training program</div>
        <div className="ia-page-subtitle text-dim">Build a 12-week block, schedule workouts, and set weekly %.</div>

        <div className="mt-3 ia-tile ia-tile-pad">
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
        </div>
      </main>

      <BottomNav />
    </>
  );
}
