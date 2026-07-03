import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { assignProgramToMember } from "../../../lib/programAssignments";

type ApiResponse =
  | {
      ok: true;
      user_email: string;
      wrote: number;
      keys: string[];
      program_assignment?: any;
    }
  | {
      error: string;
      details?: string;
    };

type UserType = "gym" | "online";
type MembershipStatus = "gym_member" | "online_user" | "none" | "trial" | "cancelled";

const ALLOWED_STRING_FIELDS = new Set([
  "sex",
  "DOB",
  "job_type",
  "goal_primary",
  "goal_intensity",

  "program_id",
  "program_name",
  "workout_type",

  "user_type",
  "membership_status",
  "gym_id",
  "gym_name",

  "location",

  "billing_plan",
  "payment_method_type",
  "direct_debit_status",
  "direct_debit_provider",
  "direct_debit_setup_url",

  "parq_status",
  "parq_completed_at",

  "onboarding_started_at",
  "onboarding_completed_at",
]);

const ALLOWED_NUMBER_FIELDS = new Set([
  "height_cm",
  "weight_kg",
  "bodyfat_pct",
  "activity_factor",

  "caloric_target",
  "calorie_target",
  "protein_target",
  "carb_target",
  "fat_target",
]);

const ALLOWED_OBJECT_FIELDS = new Set(["equipment", "preferences"]);

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function cleanNullableString(value: unknown): string | null {
  if (value === null) return null;
  if (value === undefined) return null;

  const text = String(value).trim();

  return text ? text : null;
}

function cleanNullableNumber(value: unknown): number | null {
  if (value === null) return null;
  if (value === undefined) return null;

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function cleanNullableBoolean(value: unknown): boolean | null {
  if (value === null) return null;
  if (typeof value === "boolean") return value;

  return null;
}

function normaliseUserType(value: unknown): UserType | null {
  const cleaned = cleanNullableString(value);

  if (cleaned === "gym") return "gym";
  if (cleaned === "online") return "online";

  return null;
}

function normaliseMembershipStatus(value: unknown): MembershipStatus | null {
  const cleaned = cleanNullableString(value);

  if (cleaned === "gym_member") return "gym_member";
  if (cleaned === "online_user") return "online_user";
  if (cleaned === "none") return "none";
  if (cleaned === "trial") return "trial";
  if (cleaned === "cancelled") return "cancelled";

  return null;
}

function addStringFieldIfPresent(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: string
) {
  if (!hasOwn(body, key)) return;
  if (!ALLOWED_STRING_FIELDS.has(key)) return;

  if (key === "user_type") {
    payload[key] = normaliseUserType(body[key]);
    return;
  }

  if (key === "membership_status") {
    payload[key] = normaliseMembershipStatus(body[key]);
    return;
  }

  payload[key] = cleanNullableString(body[key]);
}

function addNumberFieldIfPresent(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: string
) {
  if (!hasOwn(body, key)) return;
  if (!ALLOWED_NUMBER_FIELDS.has(key)) return;

  payload[key] = cleanNullableNumber(body[key]);
}

function addObjectFieldIfPresent(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: string
) {
  if (!hasOwn(body, key)) return;
  if (!ALLOWED_OBJECT_FIELDS.has(key)) return;

  const value = body[key];

  if (value === undefined) return;

  payload[key] = value ?? null;
}

function addBooleanFieldIfPresent(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: string
) {
  if (!hasOwn(body, key)) return;

  const cleaned = cleanNullableBoolean(body[key]);

  if (cleaned !== null) {
    payload[key] = cleaned;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: `Method ${req.method} Not Allowed`,
    });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = (req.body || {}) as Record<string, unknown>;

  const sessionEmail = String(session.user.email || "").trim().toLowerCase();
  const bodyEmail = String(body.email || "").trim().toLowerCase();

  if (!sessionEmail) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (bodyEmail && bodyEmail !== sessionEmail) {
    return res.status(403).json({
      error: "Email mismatch",
    });
  }

  const userEmail = sessionEmail;

  try {
    const usersRef = firestore.collection("users").doc(userEmail);
    const snap = await usersRef.get();
    const existingUserData = snap.exists ? ((snap.data() || {}) as any) : {};
    const nowIso = new Date().toISOString();

    const payload: Record<string, unknown> = {
      email: userEmail,
      updated_at: nowIso,
      last_login_at: nowIso,
    };

    if (!snap.exists) {
      payload.created_at = nowIso;
    }

    // Metrics
    addStringFieldIfPresent(body, payload, "sex");
    addStringFieldIfPresent(body, payload, "DOB");
    addNumberFieldIfPresent(body, payload, "height_cm");
    addNumberFieldIfPresent(body, payload, "weight_kg");
    addNumberFieldIfPresent(body, payload, "bodyfat_pct");

    // Activity
    addStringFieldIfPresent(body, payload, "job_type");
    addNumberFieldIfPresent(body, payload, "activity_factor");

    // Goals
    addStringFieldIfPresent(body, payload, "goal_primary");
    addStringFieldIfPresent(body, payload, "goal_intensity");

    // Program selection
    addStringFieldIfPresent(body, payload, "program_id");
    addStringFieldIfPresent(body, payload, "program_name");
    addStringFieldIfPresent(body, payload, "workout_type");

    // Gym / online selection
    addStringFieldIfPresent(body, payload, "user_type");
    addStringFieldIfPresent(body, payload, "membership_status");
    addStringFieldIfPresent(body, payload, "gym_id");
    addStringFieldIfPresent(body, payload, "gym_name");

    // Billing / payment setup
    addStringFieldIfPresent(body, payload, "billing_plan");
    addStringFieldIfPresent(body, payload, "payment_method_type");
    addStringFieldIfPresent(body, payload, "direct_debit_status");
    addStringFieldIfPresent(body, payload, "direct_debit_provider");
    addStringFieldIfPresent(body, payload, "direct_debit_setup_url");

    // Nutrition targets
    const hasCaloricTarget = hasOwn(body, "caloric_target");
    const hasCalorieTarget = hasOwn(body, "calorie_target");

    const resolvedCalorieTarget = hasCaloricTarget
      ? cleanNullableNumber(body.caloric_target)
      : hasCalorieTarget
      ? cleanNullableNumber(body.calorie_target)
      : undefined;

    if (resolvedCalorieTarget !== undefined) {
      payload.caloric_target = resolvedCalorieTarget;
      payload.calorie_target = resolvedCalorieTarget;
    }

    addNumberFieldIfPresent(body, payload, "protein_target");
    addNumberFieldIfPresent(body, payload, "carb_target");
    addNumberFieldIfPresent(body, payload, "fat_target");

    // Context fields
    addStringFieldIfPresent(body, payload, "location");

    // Extras
    addObjectFieldIfPresent(body, payload, "equipment");
    addObjectFieldIfPresent(body, payload, "preferences");

    // PAR-Q
    addStringFieldIfPresent(body, payload, "parq_status");
    addStringFieldIfPresent(body, payload, "parq_completed_at");

    // Onboarding markers
    addStringFieldIfPresent(body, payload, "onboarding_started_at");
    addBooleanFieldIfPresent(body, payload, "onboarding_complete");

    if (hasOwn(body, "onboarding_completed_at")) {
      const completedAt = cleanNullableString(body.onboarding_completed_at);

      if (completedAt) {
        payload.onboarding_completed_at = completedAt;
      }
    } else if (body.onboarding_complete === true) {
      payload.onboarding_completed_at = nowIso;
    }

    /**
     * Default membership status only when user_type is explicitly sent and
     * membership_status is not explicitly sent.
     */
    if (hasOwn(body, "user_type") && !hasOwn(body, "membership_status")) {
      const userType = normaliseUserType(body.user_type);

      if (userType === "gym") {
        payload.membership_status = "gym_member";
      }

      if (userType === "online") {
        payload.membership_status = "online_user";
      }
    }

    const writeKeys = Object.keys(payload);

    await usersRef.set(payload, { merge: true });

    let programAssignmentResult: any = null;

    const shouldAssignProgram =
      body.onboarding_complete === true &&
      hasOwn(body, "program_id") &&
      typeof body.program_id === "string" &&
      body.program_id.trim().length > 0;

    if (shouldAssignProgram) {
      const selectedProgramId = String(body.program_id || "").trim();

      const selectedGymId =
        typeof body.gym_id === "string" && body.gym_id.trim()
          ? body.gym_id.trim()
          : typeof existingUserData?.gym_id === "string" && existingUserData.gym_id.trim()
          ? existingUserData.gym_id.trim()
          : "g1";

      const activeProgramId = String(existingUserData?.active_program_id || "").trim();

      if (selectedProgramId && selectedProgramId !== activeProgramId) {
        try {
          programAssignmentResult = await assignProgramToMember({
            userEmail,
            gymId: selectedGymId,
            programId: selectedProgramId,
            startDate: new Date(),
            note: "Assigned automatically from onboarding",
            createdBy: userEmail,
            sendNotification: false,
            skipIfAlreadyActive: true,
          });
        } catch (assignmentErr: any) {
          console.error(
            "[onboarding/save] program assignment error:",
            assignmentErr?.message || assignmentErr
          );

          return res.status(500).json({
            error: "Onboarding saved, but failed to assign program",
            details: assignmentErr?.message || "Unknown assignment error",
          });
        }
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[onboarding/save] users doc:", userEmail, "keys:", writeKeys);

      if (programAssignmentResult) {
        console.log("[onboarding/save] program assignment:", programAssignmentResult);
      }
    }

    return res.status(200).json({
      ok: true,
      user_email: userEmail,
      wrote: writeKeys.length,
      keys: writeKeys,
      program_assignment: programAssignmentResult,
    });
  } catch (err: any) {
    console.error("[onboarding/save] error:", err?.message || err);

    return res.status(500).json({
      error: "Failed to save onboarding",
      details: err?.message || "Unknown error",
    });
  }
}
