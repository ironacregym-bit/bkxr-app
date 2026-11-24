# Build status

## Completed

- [x] Existing monorepo and applications inspected; EnAIble added as a
  separate Turbo workspace.
- [x] Phase 1 foundation: Firebase Email/Password client authentication,
  server-verified HttpOnly sessions, organisation creation and selection,
  membership-derived roles, signed active-tenant context and an empty-state
  tenant dashboard.
- [x] Default-deny Firestore client rules and Firebase configuration added.
- [x] Initial tenant-cookie and Zod validation unit tests added.
- [x] EnAIble setup notes and architecture/convention documentation added.

## Outstanding

- [ ] Run dependency installation, type checking, tests and a production build.
- [ ] Configure Firebase project credentials and enable Email/Password auth.
- [ ] Add signup email verification, password recovery, invitations and member
  administration.
- [ ] Add rate limiting, abuse protection, retention controls and production
  deployment configuration.
- [ ] Implement the configurable agent foundation (schemas, registry, provider
  abstraction, workflow and JSON screen renderer).
- [ ] Decide and migrate the existing workout builder only after tenant-safe
  platform foundations are available.
- [ ] Do not implement the invoice agent before authentication, tenancy,
  database and configuration foundations are complete.
- [ ] Continue the separate gym Tailwind/shadcn migration; do not remove legacy
  CSS until all consumers have been migrated and verified.

## Architectural decisions

- EnAIble is a distinct Next.js app and does not replace the gym app.
- The initial EnAIble milestone is Phase 1 only; no agent or invoice workflow
  is claimed complete.
- Firebase Admin access is imported from `@pt/firebase/admin` so unrelated
  consumers of the shared client Firebase barrel do not initialize Admin.
- Tenant identity is derived from a signed HttpOnly active-tenant cookie and
  revalidated against the authenticated user's Firestore membership on every
  tenant-scoped request.
- Firestore browser access is denied. Server APIs use Firebase Admin and must
  explicitly enforce tenant ownership and role permissions.

## Known limitations and validation

- Node.js/npm is unavailable in the current environment, so automated tests,
  type checks and builds have not been run.
- Firebase credentials, Firebase Email/Password provider, local runtime and
  deployment have not been configured or verified.
- Authentication currently supports email/password only. Rate limiting,
  account recovery, email verification, MFA and user invitations are not
  implemented.
- Existing website SMTP configuration and the incomplete gym styling
  migration are outside this EnAIble foundation milestone.
