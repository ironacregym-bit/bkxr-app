"use client";

import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState } from "react";
import BottomNav from "../../../components/BottomNav";

import ProgramMetaStep from "../../../components/program-create/ProgramMetaStep";
import ProgramScheduleStep, {
  ProgramScheduleItem,
} from "../../../components/program-create/ProgramScheduleStep";

export type ProgramDraft = {
  name: string;
  start_date: string;
  weeks: number;
  assigned_to: string[];
  schedule: ProgramScheduleItem[];
};

export default function CreateProgramPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role || "user";

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

  const [step, setStep] = useState(1);

  const [program, setProgram] = useState<ProgramDraft>({
    name: "",
    start_date: "",
    weeks: 12,
    assigned_to: [],
    schedule: [],
  });

  return (
    <>
      <Head>
        <title>Create Training Program • Admin</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <h2 className="mb-3">Create Training Program</h2>

        {step === 1 && (
          <ProgramMetaStep
            value={program}
            onChange={(v) => setProgram({ ...program, ...v })}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <ProgramScheduleStep
            value={program.schedule}
            onChange={(schedule) => setProgram({ ...program, schedule })}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {/* Step 3: Per-week % progression (next batch) */}
        {/* Step 4: Review & create */}

      </main>

      <BottomNav />
    </>
  );
}
