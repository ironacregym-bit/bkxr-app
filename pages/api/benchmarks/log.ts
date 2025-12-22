
// pages/api/benchmarks/log.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type PartName = "engine" | "power" | "core" | "ladder" | "load";
type Style = "AMRAP" | "EMOM" | "LADDER" | string;

type PartMetrics = {
  style?: Style;
  rounds_completed?: number | null;
  weight_kg?: number | null;
  notes?: string | null;
};

type Payload = {
  workout_id?: string;
  completion_id?: string; // optional: update existing completion
  // Optional custom dates (normally server sets now)
  completed_date?: string; // ISO
  started_at?: string;     // ISO
  // Per-part metrics (all optional)
  engine?: PartMetrics;
  power?: PartMetrics;
  core?: PartMetrics;
  ladder?: PartMetrics;
  load?: PartMetrics;
  // Optional top-level notes
  notes?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const body = req.body as Payload;
  if (!body) return res.status(400).json({ error: "Missing payload" });

  const userEmail = session.user.email;
  const { workout_id, completion_id } = body;

  // Minimal validation: at least one part has either rounds or weight
  const parts: PartName[] = ["engine", "power", "core", "ladder", "load"];
  const provided: Record<PartName, PartMetrics> = {} as any;

  let anyProvided = false;
  for (const p of parts) {
    const v = (body as any)[p] as PartMetrics | undefined;
    if (!v) continue;

    const cleaned: PartMetrics = {
      style: v.style || undefined,
      rounds_completed:
        v.rounds_completed != null && Number.isFinite(Number(v.rounds_completed))
          ? Math.max(0, Math.floor(Number(v.rounds_completed)))
          : undefined,
      weight_kg:
        v.weight_kg != null && Number.isFinite(Number(v.weight_kg))
          ? Number(v.weight_kg)
          : v.weight_kg === null
          ? null
          : undefined,
      notes: typeof v.notes === "string" ? v.notes : undefined,
    };

    // Only keep the key if at least one field is present
    const hasContent =
      cleaned.style != null ||
      cleaned.rounds_completed != null ||
      cleaned.weight_kg != null ||
      cleaned.notes != null;

    if (hasContent) {
      provided[p] = cleaned;
      anyProvided = true;
    }
  }

  if (!anyProvided) {
    return res.status(400).json({ error: "Provide at least one part with rounds or weight" });
  }

  // Compute optional aggregates
  const totalRounds = parts.reduce((sum, p) => {
    const rc = provided[p]?.rounds_completed;
    return sum + (rc != null ? rc : 0);
  }, 0);

  const maxWeight = parts.reduce((max, p) => {
    const w = provided[p]?.weight_kg;
    return w != null ? Math.max(max, w) : max;
  }, 0);

  // Construct update
  const now = new Date();
  const updateData: any = {
    is_benchmark: true,
    benchmark_metrics: provided,
    // keep aggregates optional; won’t break old readers
    sets_completed: totalRounds,
    weight_completed_with: Number.isFinite(maxWeight) && maxWeight > 0 ? maxWeight : null,
  };

  if (body.notes) updateData.notes = String(body.notes);

  // Allow optional explicit date fields
  if (body.completed_date) updateData.completed_date = new Date(body.completed_date);
  else updateData.completed_date = now;

  if (body.started_at) updateData.started_at = new Date(body.started_at);

  try {
    // If completion_id is provided, patch that doc
    if (completion_id) {
      const ref = firestore.collection("workoutCompletions").doc(completion_id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: "completion_id not found" });
      // Guard user ownership
      const prev = snap.data() as any;
      if (prev.user_email && prev.user_email !== userEmail) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await ref.set(updateData, { merge: true });
      const updated = await ref.get();
      return res.status(200).json({ ok: true, id: ref.id, data: updated.data() });
    }

    // Otherwise, create a fresh completion
    if (!workout_id) return res.status(400).json({ error: "workout_id is required when creating a completion" });

    const ref = firestore.collection("workoutCompletions").doc();
    await ref.set({
      user_email: userEmail,
      workout_id: String(workout_id),
      ...updateData,
      created_at: now,
    });

    const created = await ref.get();
    return res.status(201).json({ ok: true, id: ref.id, data: created.data() });
  } catch (err: any) {
    console.error("[benchmarks/log] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to log benchmark result" });
  }
}
