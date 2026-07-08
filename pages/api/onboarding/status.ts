import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function toIso(value: any): string | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(
    req,
    res,
    authOptions
  );

  const userEmail = String(
    session?.user?.email || ""
  )
    .trim()
    .toLowerCase();

  if (!userEmail) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  try {
    const userRef = firestore
      .collection("users")
      .doc(userEmail);

    const userSnap = await userRef.get();

    const user = userSnap.exists
      ? userSnap.data() || {}
      : {};

    //
    // PAR-Q lookup
    //

    let parqDoc: any = null;
    let parqDocId: string | null = null;

    const byUserEmail = await firestore
      .collection("parq_responses")
      .where("user_email", "==", userEmail)
      .limit(1)
      .get();

    if (!byUserEmail.empty) {
      parqDoc = byUserEmail.docs[0].data();
      parqDocId = byUserEmail.docs[0].id;
    }

    if (!parqDoc) {
      const byProvidedEmail = await firestore
        .collection("parq_responses")
        .where("provided_email", "==", userEmail)
        .limit(1)
        .get();

      if (!byProvidedEmail.empty) {
        parqDoc = byProvidedEmail.docs[0].data();
        parqDocId = byProvidedEmail.docs[0].id;
      }
    }

    const parqCompleted = !!parqDoc;

    //
    // Programme lookup
    //

    const programmeSnap = await firestore
      .collection("program_assignments")
      .where("userEmail", "==", userEmail)
      .where("status", "==", "active")
      .limit(1)
      .get();

    const activeProgramme = programmeSnap.empty
      ? null
      : programmeSnap.docs[0].data();

    //
    // Membership
    //

    const userType =
      user.user_type ||
      (user.gym_id ? "gym" : "online");

    const isGymMember =
      userType === "gym" ||
      user.membership_status === "gym_member";

    //
    // Required actions
    //

    const requiredActions: Array<{
      key: string;
      title: string;
      href: string;
    }> = [];

    if (isGymMember && !parqCompleted) {
      requiredActions.push({
        key: "parq_required",
        title: "Complete your PAR-Q",
        href: "/parq?returnTo=/",
      });
    }

    //
    // Keep users doc synced automatically
    //

    if (
      parqCompleted &&
      user.parq_status !== "completed"
    ) {
      await userRef.set(
        {
          parq_status: "completed",
          parq_completed_at:
            toIso(parqDoc.created_at),
          parq_response_id: parqDocId,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    return res.status(200).json({
      ok: true,

      email: userEmail,

      onboarding: {
        complete: !!user.onboarding_complete,
        started_at: user.onboarding_started_at || null,
        completed_at:
          user.onboarding_completed_at || null,
      },

      parq: {
        completed: parqCompleted,
        status: parqCompleted
          ? "completed"
          : "not_started",
        response_id: parqDocId,
        completed_at: parqDoc
          ? toIso(parqDoc.created_at)
          : null,
        requires_medical_review:
          parqDoc?.requires_medical_review === true,
      },

      membership: {
        user_type: userType || null,
        membership_status:
          user.membership_status || null,
        gym_id: user.gym_id || null,
        can_book_classes:
          !isGymMember || parqCompleted,
      },

      billing: {
        billing_plan:
          user.billing_plan || null,
        payment_method_type:
          user.payment_method_type || null,
        direct_debit_status:
          user.direct_debit_status || null,
      },

      programme: {
        program_id:
          user.program_id ||
          activeProgramme?.programId ||
          null,

        program_name:
          user.program_name || null,

        active_assignment:
          activeProgramme || null,
      },

      required_actions: requiredActions,
    });
  } catch (err: any) {
    console.error(
      "[member/status]",
      err?.message || err
    );

    return res.status(500).json({
      error: "Failed to load member status",
    });
  }
}
