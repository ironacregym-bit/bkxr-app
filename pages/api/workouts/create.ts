
// pages/api/workouts/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db, Timestamp } from '../../../lib/firebaseAdmin';
import {
  WorkoutCreatePayload, RoundOut, ExerciseItemOut, WorkoutTemplateDTO, KBStyle
} from '../../../types/workouts';

// --- Helpers ---
function assertPayload(p: WorkoutCreatePayload) {
  if (!p.visibility) throw new Error('visibility is required');
  if (p.visibility === 'private' && !p.owner_email) throw new Error('owner_email is required for private templates');
  if (!p.workout_name) throw new Error('workout_name is required');

  // Boxing: exactly 5 rounds; each round = exactly 3 combos; each combo has >=1 action
  if (!p.boxing?.rounds || p.boxing.rounds.length !== 5) throw new Error('boxing.rounds must contain exactly 5 rounds');
  p.boxing.rounds.forEach((r, idx) => {
    if (!Array.isArray(r.combos) || r.combos.length !== 3) {
      throw new Error(`boxing.rounds[${idx}] must contain exactly 3 combos`);
    }
    r.combos.forEach((combo, j) => {
      if (!Array.isArray(combo.actions) || combo.actions.length < 1) {
        throw new Error(`boxing.rounds[${idx}].combos[${j}] must contain at least 1 action`);
      }
      combo.actions.forEach((a, k) => {
        if (!a.kind || !['punch', 'defence'].includes(a.kind)) {
          throw new Error(`boxing action kind invalid at [${idx}][${j}][${k}]`);
        }
        if (!a.code || typeof a.code !== 'string') {
          throw new Error(`boxing action code required at [${idx}][${j}][${k}]`);
        }
      });
    });
  });

  // Kettlebell: exactly 5 rounds; valid style; each round has >=1 item with exercise_id + order
  if (!p.kettlebell?.rounds || p.kettlebell.rounds.length !== 5) throw new Error('kettlebell.rounds must contain exactly 5 rounds');
  p.kettlebell.rounds.forEach((r, idx) => {
    if (!r.style || !['EMOM', 'AMRAP', 'LADDER'].includes(r.style)) {
      throw new Error(`kettlebell.rounds[${idx}].style must be EMOM | AMRAP | LADDER`);
    }
    if (!Array.isArray(r.items) || r.items.length < 1) {
      throw new Error(`kettlebell.rounds[${idx}].items must contain at least 1 exercise`);
    }
    r.items.forEach((it, j) => {
      if (!it.exercise_id) throw new Error(`kettlebell.rounds[${idx}].items[${j}].exercise_id is required`);
      if (typeof it.order !== 'number') throw new Error(`kettlebell.rounds[${idx}].items[${j}].order must be a number`);
    });
  });
}

function boxingRoundName(n: number, provided?: string) {
  return provided?.trim() || `Boxing Round ${n}`;
}
function kettlebellRoundName(n: number, provided?: string) {
  return provided?.trim() || `Kettlebells Round ${n}`;
}

// --- Handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = req.body as WorkoutCreatePayload;
  try {
    assertPayload(payload);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  if (payload.dry_run) {
    return res.status(200).json({ ok: true, message: 'Validation passed (dry-run). No writes performed.' });
  }

  try {
    const workoutRef = payload.workout_id
      ? db.collection('workouts').doc(payload.workout_id)
      : db.collection('workouts').doc();

    const now = Timestamp.now();
    const batch = db.batch();

    // Workout doc
    batch.set(
      workoutRef,
      {
        workout_name: payload.workout_name,
        focus: payload.focus ?? null,
        notes: payload.notes ?? null,
        video_url: payload.video_url ?? null,
        is_benchmark: payload.is_benchmark ?? false,
        benchmark_name: payload.benchmark_name ?? null,
        visibility: payload.visibility,
        owner_email: payload.visibility === 'private' ? payload.owner_email : null,
        created_at: now,
        updated_at: now,
      },
      { merge: true }
    );

    const roundsOut: RoundOut[] = [];

    // Boxing rounds (1..5), each 180s
    for (let i = 0; i < payload.boxing.rounds.length; i++) {
      const order = i + 1;
      const b = payload.boxing.rounds[i];
      const roundRef = workoutRef.collection('rounds').doc();

      batch.set(roundRef, {
        name: boxingRoundName(order, b.name),
        order,
        category: 'Boxing',
        duration_s: 180,
        is_benchmark_component: false,
      });

      const itemsOut: ExerciseItemOut[] = [];
      for (let j = 0; j < b.combos.length; j++) {
        const combo = b.combos[j];
        const itemRef = roundRef.collection('items').doc();

        batch.set(itemRef, {
          type: 'Boxing',
          style: 'Combo',
          order: j + 1,
          duration_s: 180,
          combo: {
            name: combo.name ?? null,
            actions: combo.actions,
            notes: combo.notes ?? null,
          },
        });

        itemsOut.push({
          item_id: itemRef.id,
          type: 'Boxing',
          style: 'Combo',
          order: j + 1,
          duration_s: 180,
          combo: { name: combo.name, actions: combo.actions, notes: combo.notes },
        });
      }

      roundsOut.push({
        round_id: roundRef.id,
        name: boxingRoundName(order, b.name),
        order,
        category: 'Boxing',
        duration_s: 180,
        is_benchmark_component: false,
        items: itemsOut,
      });
    }

    // Kettlebell rounds (6..10)
    for (let k = 0; k < payload.kettlebell.rounds.length; k++) {
      const order = 6 + k;
      const r = payload.kettlebell.rounds[k];
      const roundRef = workoutRef.collection('rounds').doc();

      batch.set(roundRef, {
        name: kettlebellRoundName(k + 1, r.name),
        order,
        category: 'Kettlebell',
        style: r.style,
        is_benchmark_component: r.is_benchmark_component ?? false,
      });

      const sortedItems = [...r.items].sort((a, b) => a.order - b.order);
      const itemsOut: ExerciseItemOut[] = [];

      for (const item of sortedItems) {
        const itemRef = roundRef.collection('items').doc();

        batch.set(itemRef, {
          type: 'Kettlebell',
          style: item.style ?? r.style,
          order: item.order,
          exercise_id: item.exercise_id,
          reps: item.reps ?? null,
          time_s: item.time_s ?? null,
          weight_kg: item.weight_kg ?? null,
          tempo: item.tempo ?? null,
          rest_s: item.rest_s ?? null,
          notes: item.notes ?? null,
        });

        itemsOut.push({
          item_id: itemRef.id,
          type: 'Kettlebell',
          style: (item.style ?? r.style) as KBStyle,
          order: item.order,
          exercise_id: item.exercise_id,
          reps: item.reps,
          time_s: item.time_s,
          weight_kg: item.weight_kg,
          tempo: item.tempo,
          rest_s: item.rest_s,
        });
      }

      roundsOut.push({
        round_id: roundRef.id,
        name: kettlebellRoundName(k + 1, r.name),
        order,
        category: 'Kettlebell',
        style: r.style,
        is_benchmark_component: r.is_benchmark_component ?? false,
        items: itemsOut,
      });
    }

    // Commit all writes atomically
    await batch.commit();

    const dto: WorkoutTemplateDTO = {
      workout_id: workoutRef.id,
      visibility: payload.visibility,
      owner_email: payload.visibility === 'private' ? payload.owner_email : undefined,
      workout_name: payload.workout_name,
      focus: payload.focus,
      notes: payload.notes,
      video_url: payload.video_url,
      is_benchmark: payload.is_benchmark,
      benchmark_name: payload.benchmark_name,
      created_at: now.toDate().toISOString(),
      updated_at: now.toDate().toISOString(),
      rounds: roundsOut,
    };

    return res.status(200).json(dto);
  } catch (err: any) {
    console.error('workouts/create error', err);
    return res.status(500).json({ error: 'Failed to create BXKR workout template' });
  }
}

