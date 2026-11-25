import type {
  NextApiRequest,
  NextApiResponse,
} from "next";
import { adminAuth, adminDb } from "@pt/firebase/admin";
import type { TenantRole } from "./schemas";
import { tenantRoleSchema } from "./schemas";
import { signTenantCookie, verifyTenantCookie } from "./tenant-cookie";

const SESSION_COOKIE = "enaible_session";
const TENANT_COOKIE = "enaible_active_tenant";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
const INVALID_ID_TOKEN_CODES = new Set([
  "auth/argument-error",
  "auth/invalid-id-token",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);
const INVALID_SESSION_COOKIE_CODES = new Set([
  "auth/argument-error",
  "auth/invalid-session-cookie",
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);

function firebaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
}

export function isInvalidFirebaseIdToken(error: unknown) {
  const code = firebaseErrorCode(error);
  return code ? INVALID_ID_TOKEN_CODES.has(code) : false;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type AuthenticatedUser = {
  uid: string;
  email: string | null;
  name: string | null;
};

export type TenantContext = AuthenticatedUser & {
  tenantId: string;
  tenantName: string;
  role: TenantRole;
};

function readCookie(
  req: NextApiRequest,
  name: string
): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key !== name) continue;

    try {
      return decodeURIComponent(valueParts.join("="));
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function cookieOptions(maxAge: number) {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(process.env.NODE_ENV === "production"
      ? ["Secure"]
      : []),
  ].join("; ");
}

export function sessionCookieHeader(value: string) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; ${cookieOptions(SESSION_MAX_AGE_SECONDS)}`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; ${cookieOptions(0)}`;
}

export function clearTenantCookieHeader() {
  return `${TENANT_COOKIE}=; ${cookieOptions(0)}`;
}

export function activeTenantCookieHeader(
  userId: string,
  tenantId: string
) {
  const secret = process.env.ENAIBLE_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ENAIBLE_SESSION_SECRET must be set to at least 32 characters."
    );
  }

  const value = signTenantCookie(userId, tenantId, secret);
  return `${TENANT_COOKIE}=${encodeURIComponent(value)}; ${cookieOptions(SESSION_MAX_AGE_SECONDS)}`;
}

export async function requireUser(
  req: NextApiRequest
): Promise<AuthenticatedUser> {
  const sessionCookie = readCookie(req, SESSION_COOKIE);
  if (!sessionCookie) {
    throw new ApiError(401, "Authentication required");
  }

  try {
    const claims = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    );

    return {
      uid: claims.uid,
      email: typeof claims.email === "string" ? claims.email : null,
      name: typeof claims.name === "string" ? claims.name : null,
    };
  } catch (error) {
    if (INVALID_SESSION_COOKIE_CODES.has(firebaseErrorCode(error) || "")) {
      throw new ApiError(401, "Session expired. Please sign in again.");
    }
    throw error;
  }
}

export async function requireTenantContext(
  req: NextApiRequest
): Promise<TenantContext> {
  const user = await requireUser(req);
  const tenantCookie = readCookie(req, TENANT_COOKIE);
  const secret = process.env.ENAIBLE_SESSION_SECRET;

  if (!tenantCookie || !secret || secret.length < 32) {
    throw new ApiError(403, "Select an organisation to continue");
  }

  const tenantId = verifyTenantCookie(
    tenantCookie,
    user.uid,
    secret
  );
  if (!tenantId) {
    throw new ApiError(403, "Organisation session is invalid");
  }

  const tenantRef = adminDb.collection("tenants").doc(tenantId);
  const [tenantSnapshot, memberSnapshot] = await Promise.all([
    tenantRef.get(),
    tenantRef.collection("members").doc(user.uid).get(),
  ]);
  if (!tenantSnapshot.exists || !memberSnapshot.exists) {
    throw new ApiError(403, "You are not a member of this organisation");
  }

  const member = memberSnapshot.data();
  const roleResult = tenantRoleSchema.safeParse(member?.role);
  if (
    member?.tenantId !== tenantId ||
    member?.userId !== user.uid ||
    !roleResult.success
  ) {
    throw new ApiError(403, "Organisation membership is invalid");
  }

  return {
    ...user,
    tenantId,
    tenantName: String(tenantSnapshot.get("name") || "Organisation"),
    role: roleResult.data,
  };
}

export function requireRole(
  context: TenantContext,
  allowedRoles: TenantRole[]
) {
  if (!allowedRoles.includes(context.role)) {
    throw new ApiError(403, "You do not have permission to do this");
  }
}

export function sendApiError(
  res: NextApiResponse,
  error: unknown,
  fallbackMessage = "Request failed"
) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: error.message,
    });
  }

  console.error("[EnAIble API]", error);
  return res.status(500).json({
    error: fallbackMessage,
  });
}

export { adminAuth, adminDb };
