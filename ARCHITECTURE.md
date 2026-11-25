# Architecture

## Repository

The repository is an npm-workspaces/Turborepo monorepo containing four
applications:

- `apps/iron-acre-web`: the public Iron Acre marketing and lead-capture site,
  including local service pages for outdoor gym training, functional strength,
  boxing, online coaching, prices/times and a seven-day starter workout.
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
- SiteBuilder has its own NextAuth configuration, cookie names, and redirect
  policy; it does not import the gym app's auth callbacks. Its Firebase
  adapter uses the adapter's default Firestore collections, while dashboard
  permission is read server-side from the persisted user record and site
  ownership/editor access is checked against each site.
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
- **Email:** `packages/email-engine` is the reusable SMTP sender and
  server-to-server client. EnAible hosts a tenant-scoped email API and
  stateless Streamable HTTP MCP endpoint. Apps and agents use per-tenant API
  keys; the tenant is derived from the stored credential, never from request
  input.
- **Approved sends:** owners and administrators create plain-text templates,
  which is the explicit human approval step for automated sends. API keys are
  limited to exact recipient domains and 20 send attempts per key per UTC day.
  The server stores only a hash of each API key, validates variables against
  template placeholders, uses idempotency records, and stores email request
  records beneath the tenant with `tenantId`. SMTP credentials and `EMAIL_FROM`
  remain server-only and shared globally by the EnAible service.

## SiteBuilder payments

- Each SiteBuilder site can connect its owner's Stripe Express account using
  the platform's server-side `STRIPE_SECRET_KEY`. Connected account IDs and
  product configuration are stored with that site; secret keys and card
  details are never stored in Firestore or sent to the browser.
- Only the persisted site owner can connect Stripe or change payment products.
  Checkout resolves the public slug, enabled product, price and connected
  account from Firestore; browser input cannot select a price or recipient.
- Payments use direct Stripe Checkout sessions on the site's connected
  account. The initial implementation supports one-time products in GBP, EUR
  and USD. It does not include recurring subscriptions, order fulfillment,
  refunds, or an in-app order-management screen.
- `STRIPE_SECRET_KEY` must be configured on the SiteBuilder Vercel project.
  `SITEBUILDER_STRIPE_ACCOUNT_COUNTRY` optionally chooses the Connect account
  country and defaults to `GB`. Configure `NEXTAUTH_URL` and `SITEBUILDER_URL`
  to the canonical SiteBuilder origin and use a unique
  `SITEBUILDER_NEXTAUTH_SECRET`; do not reuse the Iron Acre Gym auth secret.
  Configure `SITEBUILDER_BASE_HOST`/`SITEBUILDER_BASE_HOSTS` for allowed hosted
  domains. The connected accounts need Stripe's
  `card_payments` capability enabled before products can be published.
- The checkout return page verifies the Stripe session against the connected
  account before displaying a successful payment confirmation.

## Tenant data

The current foundation creates `tenants/{tenantId}` and its `members` subcollection.
The global `users/{userId}` profile is identity data, not tenant-owned data.
Future tenant-owned agents, workflows, screens, executions, approvals,
documents, integrations, evaluation runs and audit records must live beneath
their tenant and include a matching `tenantId` field.

## Email and MCP

- Each organisation manages API keys and approved templates beneath
  `tenants/{tenantId}/emailApiKeys` and
  `tenants/{tenantId}/emailTemplates`. Key-management APIs require a current
  authenticated owner/administrator membership. External requests authenticate
  with a high-entropy Bearer key whose stored hash is verified in constant
  time; the key's encoded tenant ID is only a lookup hint and must match the
  persisted tenant and key records.
- `POST /api/email/send` and `POST /api/mcp` share the same sending service.
  MCP exposes `send_approved_email`; it cannot supply arbitrary HTML, subject,
  or message body. The email text and subject come from an owner-approved
  tenant template, while variables are restricted to its declared placeholders.
- Recipient domains are exact-match allowlists attached to each key. The
  server caps each key at 20 send attempts per UTC day, including failed SMTP
  attempts, and uses an idempotency key to prevent repeated sends; failed or
  in-progress requests cannot be retried with that same key.
- Delivery is through the existing SMTP configuration with one service-wide
  `EMAIL_FROM` address. Per-tenant sender identities, recipient consent and
  unsubscribe management, HTML templates, attachments, and an email history
  UI are not implemented.

## Known gaps

The EnAIble app currently has no agent registry/runtime, workflow engine,
document ingestion, general-purpose provider abstraction, workflow approval
service, evaluation framework, invitations, general rate limiting, retention
controls, or production hosting configuration. These remain future milestones;
the email MCP endpoint and email-template approval controls are implemented
separately. The existing workout builder has not been moved into EnAIble; it
must be assessed for tenant-safe APIs and configurations after the platform
foundation is established.
