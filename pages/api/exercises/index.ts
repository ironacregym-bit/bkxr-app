
// pages/api/exercises/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb as db } from '../../../lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { q, limit } = req.query as { q?: string; limit?: string };

  try {
    const n = Math.min(Number(limit || 500), 1000); // cap to 1000

    let query = db.collection('exercises');

    // Optional search by name/type (prefix-based; case-insensitive client-side)
    // Firestore doesn't support contains without indexing; keep simple server-side sort + client-side filter
    const snap = await query.orderBy('exercise_name').limit(n).get();

    const exercises = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        exercise_name: x.exercise_name || '',
        type: x.type || '',
        equipment: x.equipment || '',
        video_url: x.video_url || '',
        met_value: typeof x.met_value === 'number' ? x.met_value : null,
      };
    });

    // Client-side filter if q is present
       const filtered = q
      ? exercises.filter((e) =>
          (e.exercise_name || '').toLowerCase().includes(q.toLowerCase()) ||
          (e.type || '').toLowerCase().includes(q.toLowerCase())
        )
      : exercises;

    return res.status(200).json({ exercises: filtered });
  } catch (err: any) {
    console.error('exercises/index error', err);
    return res.status(500).json({ error: 'Failed to list exercises' });
  }
}
