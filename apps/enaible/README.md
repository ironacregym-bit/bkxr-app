# EnAIble

EnAIble is a separate Next.js application in this monorepo. Its first
milestone provides Firebase Authentication, a server-verified session,
organisation membership and a tenant-scoped dashboard. Agent execution,
invoice processing and integrations are intentionally not part of this
foundation milestone.

## Local development

1. Configure Firebase Authentication with the Email/Password provider.
2. Copy `.env.example` to `.env.local` and fill in the Firebase web
   configuration, Firebase Admin service-account values and a random
   `ENAIBLE_SESSION_SECRET` of at least 32 characters.
3. From the repository root, install the monorepo dependencies and run
   `npm run enaible:dev`.
4. Open `http://localhost:3003`.

Firebase Admin credentials must remain server-side. Do not commit `.env.local`
or service-account keys. All browser Firestore reads and writes are denied by
the root Firestore rules; application data access must go through authenticated
server APIs that derive tenant membership from the session.

## Current limitations

- Email/password authentication only; password recovery, MFA, invitations and
  organisation member management are not implemented.
- Rate limiting, automated abuse controls, retention policies and production
  deployment configuration remain outstanding.
- Dashboard activity and usage cards are empty-state scaffolding; no agent or
  workflow execution is implemented yet.
