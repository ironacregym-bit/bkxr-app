import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function iso(v: any): string | null {
  try {
    if (typeof v?.toDate === "function") {
      return v.toDate().toISOString();
    }

    const d = new Date(v);

    return Number.isNaN(d.getTime())
      ? null
      : d.toISOString();
  } catch {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const session = await getServerSession(
    req,
    res,
    authOptions
  );

  const email = String(
    session?.user?.email || ""
  )
    .trim()
    .toLowerCase();

  if (!email) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  try {
    //
    // ACTIVE BLOCK
    //
    const currentSnap = await firestore
      .collection("farmstrong_settings")
      .doc("current")
      .get();

    const activeBlockId =
      currentSnap.data()?.active_block_id || null;

    let activeBlock: any = null;

    if (activeBlockId) {
      const blockSnap = await firestore
        .collection("farmstrong_blocks")
        .doc(activeBlockId)
        .get();

      if (blockSnap.exists) {
        activeBlock = {
          id: blockSnap.id,
          ...(blockSnap.data() || {}),
        };
      }
    }

    //
    // EXERCISES
    //
    const strengthExerciseIds =
      activeBlock?.exercise_ids || [];

    const exerciseDocs = await Promise.all(
      strengthExerciseIds.map((id: string) =>
        firestore
          .collection("strength_exercises")
          .doc(id)
          .get()
      )
    );

    const exercises = exerciseDocs
      .filter((x) => x.exists)
      .map((x) => ({
        id: x.id,
        ...(x.data() || {}),
      }));

    //
    // STRENGTH PROFILE
    //
    const profileRef = firestore
      .collection("strength_profiles")
      .doc(email);

    const liftsSnap = await profileRef
      .collection("lifts")
      .get();

    const lifts = await Promise.all(
      liftsSnap.docs.map(async (liftDoc) => {
        const lift = liftDoc.data() || {};

        const entriesSnap = await liftDoc.ref
          .collection("entries")
          .orderBy("recorded_at", "asc")
          .get();

        const history = entriesSnap.docs.map(
          (entryDoc) => {
            const e = entryDoc.data();

            return {
              value: Number(e.value || 0),
              recorded_at: iso(
                e.recorded_at
              ),
            };
          }
        );

        return {
          exerciseId: liftDoc.id,
          exerciseName:
            lift.exercise_name ||
            liftDoc.id,
          current:
            Number(
              lift.training_max_kg || 0
            ) || 0,
          best:
            Number(
              lift.best_true_1rm_kg || 0
            ) || 0,
          history,
        };
      })
    );

    //
    // CHECK INS
    //
    const checkInsSnap = await firestore
      .collection("check_ins")
      .where("user_email", "==", email)
      .get();

    const weightHistory = checkInsSnap.docs
      .map((doc) => {
        const d = doc.data();

        const weight =
          Number(d.weight_kg) ||
          Number(d.weight) ||
          0;

        const date =
          iso(d.week_friday_date) ||
          iso(d.created_at);

        return {
          weight_kg: weight,
          date,
        };
      })
      .filter(
        (x) =>
          x.date &&
          Number.isFinite(x.weight_kg)
      )
      .sort((a, b) =>
        String(a.date).localeCompare(
          String(b.date)
        )
      );

    //
    // FILTER TO CURRENT BLOCK EXERCISES
    //
    const blockLifts =
      strengthExerciseIds.length > 0
        ? strengthExerciseIds.map(
            (exerciseId: string) =>
              lifts.find(
                (x) =>
                  x.exerciseId === exerciseId
              ) || {
                exerciseId,
                exerciseName:
                  exercises.find(
                    (e: any) =>
                      e.id === exerciseId
                  )?.exercise_name ||
                  exerciseId,
                current: 0,
                best: 0,
                history: [],
              }
          )
        : lifts;

    return res.status(200).json({
      ok: true,

      activeBlock,

      exercises,

      weightHistory,

      lifts: blockLifts,
    });
  } catch (err: any) {
    console.error(
      "[farmstrong/dashboard]",
      err?.message || err
    );

    return res.status(500).json({
      error:
        "Failed to build dashboard",
    });
  }
}
