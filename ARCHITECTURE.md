# Architecture

## Repository

The repository is an npm-workspaces/Turborepo monorepo containing four
applications:

- `apps/iron-acre-web`: the public Iron Acre marketing and lead-capture site.
- `apps/iron-acre-app`: the gym/member application, currently using the
  Next.js Pages Router and NextAuth.
- `apps/site-builder`: the SiteBuilder application.
- `apps/enaible`: the new, separate EnAIble platform application.

The existing stack is Next.js 14, React 18, TypeScript 5, Firebase/Firestore,
and shared packages under `packages/`. Existing reusable infrastructure
includes the Firebase package and the email engine; the app styling work uses
Tailwind and existing shadcn-style primitives. EnAIble uses the same framework
and Firebase Admin infrastructure, but has its own Firebase Authentication
session and tenant model.

## Reuse boundaries and conflicts

- The gym app currently uses NextAuth rather than Firebase Authentication.
  Its authentication and roles are not reused for EnAIble because EnAIble
  requires its own Firebase-backed tenant membership model.
- The gym app's AI workout builder is tied to a Gemini-specific model
  selection path and existing global draft/execution collections. It is not
  tenant-safe as-is, so it remains in the gym app until its APIs and persisted
  data are redesigned for EnAIble's tenant boundaries.
- The shared Firebase package exposes Firestore client functionality through
  its main barrel. EnAIble imports Firebase Admin through a separate alias so
  ordinary package consumers do not eagerly initialize Admin services.
- No browser Firestore usage was found in the current applications; the new
  root rules explicitly deny browser Firestore access. Existing server-side
  Firebase Admin access remains unaffected.

## EnAIble foundation (Phase 1)

- **Frontend:** Next.js 14 Pages Router, React, TypeScript, Tailwind CSS and
  local shadcn-style UI primitives in `apps/enaible`.
- **Authentication:** Firebase Authentication Email/Password in the browser.
  The client exchanges an ID token for a five-day, HttpOnly Firebase session
  cookie. Server APIs verify the cookie before reading user or tenant data.
- **Tenant context:** memberships are stored at
  `tenants/{tenantId}/members/{userId}`. An active organisation cookie is
  signed server-side and is accepted only when the authenticated user still
  has a valid membership record for that tenant.
- **Authorisation:** each tenant-scoped request resolves role from Firestore
  membership data. Browser-supplied tenant identifiers are never trusted
  without a membership lookup.
- **Persistence:** privileged application access uses Firebase Admin through
  the dedicated `@pt/firebase/admin` TypeScript alias. The shared
  `@pt/firebase` barrel does not eagerly initialize Firebase Admin.
- **Firestore rules:** client SDK access is denied globally. Server APIs use
  Firebase Admin, which bypasses those rules; tenant checks therefore remain
  mandatory in every server operation.

## Tenant data

The current foundation creates `tenants/{tenantId}` and its `members` subcollection.
The global `users/{userId}` profile is identity data, not tenant-owned data.
Future tenant-owned agents, workflows, screens, executions, approvals,
documents, integrations, evaluation runs and audit records must live beneath
their tenant and include a matching `tenantId` field.

## Known gaps

The EnAIble app currently has no agent registry/runtime, workflow engine,
document ingestion, provider abstraction, MCP tools, approval service,
evaluation framework, invitations, rate limiting, retention controls, or
production hosting configuration. These are future milestones, not implemented
capabilities. The existing workout builder has not been moved into EnAIble;
it must be assessed for tenant-safe APIs and configurations after the platform
foundation is established.
