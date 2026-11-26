import type { NextApiRequest, NextApiResponse } from "next";
import {
  adminDb,
  ApiError,
  requireUser,
  sendApiError,
} from "@/lib/server-auth";
import {
  createOrganizationSchema,
  tenantRoleSchema,
} from "@/lib/schemas";
import { ENAIBLE_USERS_COLLECTION } from "@/lib/auth-collections";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const user = await requireUser(req, res);
      const memberships = await adminDb
        .collectionGroup("members")
        .where("userId", "==", user.uid)
        .get();

      const organizations = await Promise.all(
        memberships.docs.map(async (membershipSnapshot) => {
          const membership = membershipSnapshot.data();
          const role = tenantRoleSchema.safeParse(membership.role);
          if (
            membership.userId !== user.uid ||
            typeof membership.tenantId !== "string" ||
            membershipSnapshot.ref.path !==
              `tenants/${membership.tenantId}/members/${user.uid}` ||
            !role.success
          ) {
            throw new Error(
              `Invalid membership record: ${membershipSnapshot.ref.path}`
            );
          }

          const tenantSnapshot = await adminDb
            .collection("tenants")
            .doc(membership.tenantId)
            .get();
          if (!tenantSnapshot.exists) {
            throw new Error(
              `Membership references missing tenant: ${membership.tenantId}`
            );
          }

          const tenant = tenantSnapshot.data();
          if (
            !tenant ||
            tenant.tenantId !== membership.tenantId ||
            typeof tenant.name !== "string"
          ) {
            throw new Error(
              `Invalid tenant record: ${membership.tenantId}`
            );
          }

          return {
            tenantId: membership.tenantId,
            name: tenant.name,
            role: role.data,
          };
        })
      );

      return res.status(200).json({ organizations });
    } catch (error) {
      return sendApiError(res, error, "Could not load organisations");
    }
  }

  if (req.method === "POST") {
    if (
      typeof req.headers["content-type"] !== "string" ||
      !req.headers["content-type"].startsWith("application/json")
    ) {
      return res
        .status(415)
        .json({ error: "Content-Type must be application/json" });
    }

    const parsed = createOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Invalid organisation name",
      });
    }

    try {
      const user = await requireUser(req, res);
      const tenantRef = adminDb.collection("tenants").doc();
      const memberRef = tenantRef.collection("members").doc(user.uid);
      const now = new Date().toISOString();

      await adminDb.runTransaction(async (transaction) => {
        transaction.set(tenantRef, {
          tenantId: tenantRef.id,
          name: parsed.data.name,
          createdBy: user.uid,
          createdAt: now,
          updatedAt: now,
        });
        transaction.set(memberRef, {
          tenantId: tenantRef.id,
          userId: user.uid,
          role: "owner",
          createdAt: now,
        });
        transaction.set(
          adminDb.collection(ENAIBLE_USERS_COLLECTION).doc(user.uid),
          {
            userId: user.uid,
            email: user.email,
            name: user.name,
            updatedAt: now,
          },
          { merge: true }
        );
      });

      return res.status(201).json({
        organization: {
          tenantId: tenantRef.id,
          name: parsed.data.name,
          role: "owner",
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return sendApiError(res, error);
      }
      return sendApiError(
        res,
        error,
        "Could not create the organisation"
      );
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
