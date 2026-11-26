# Build status

## Completed

- [x] Existing monorepo and applications inspected; EnAIble added as a
  separate Turbo workspace.
- [x] Phase 1 foundation: Google OAuth through NextAuth, GCP Firestore-backed
  profiles, server-verified HttpOnly sessions, organisation creation and
  selection, membership-derived roles, signed active-tenant context and an
  empty-state tenant dashboard.
- [x] Default-deny Firestore client rules and GCP Firestore configuration
  added.
- [x] Initial tenant-cookie and Zod validation unit tests added.
- [x] EnAIble setup notes and architecture/convention documentation added.
- [x] SiteBuilder has separate editor views, collapsible admin panels, and
  Stripe Connect onboarding with configurable one-time products and secure
  hosted checkout.
- [x] SiteBuilder has an independent NextAuth configuration with app-specific
  cookies; cross-origin auth redirects are restricted to its configured
  origin.
- [x] SiteBuilder custom-domain onboarding provisions domains through Vercel,
  requires per-site DNS ownership and Vercel verification before activation,
  and routes active hosts through tenant-scoped Firestore mappings for
  persisted site owners/editors; legacy environment mappings remain supported
  during migration.
- [x] Shared `@pt/email-engine` package, tenant-scoped approved email
  templates/API keys, API send endpoint, and EnAible Streamable HTTP MCP tool
  for app and agent callers.
- [x] Iron Acre public site has responsive navigation and local landing pages
  for outdoor gym training, functional strength, boxing, online coaching,
  prices/times and the advertised seven-day workout. Existing image references
  use verified assets, and the new routes have page metadata and sitemap entries.
- [x] GitHub Actions CI workflow added for SiteBuilder tests/type-check/build
  and the Iron Acre public website build, using a root npm lockfile.
- [x] All workspaces updated to the patched Next.js 14.2.35 release, and
  monorepo output tracing configured under the Next.js 14 experimental options.

## Outstanding

- [x] Install dependencies and validate tests, type checking and production
  builds for the selected apps.
- [ ] Configure EnAIble's Google OAuth client, GCP Firestore service account,
  authorized callback URL and production secrets.
- [ ] Add organisation invitations, member administration and MFA.
- [ ] Add general rate limiting, abuse protection, retention controls and
  production deployment configuration.
- [ ] Implement the configurable agent foundation (schemas, registry, provider
  abstraction, workflow and JSON screen renderer).
- [ ] Decide and migrate the existing workout builder only after tenant-safe
  platform foundations are available.
- [ ] Do not implement the invoice agent before authentication, tenancy,
  database and configuration foundations are complete.
- [ ] Continue the separate gym Tailwind/shadcn migration; do not remove legacy
  CSS until all consumers have been migrated and verified.
- [ ] Configure and verify `STRIPE_SECRET_KEY` on the SiteBuilder Vercel
  project, then complete a Stripe test-mode Connect onboarding and checkout.
- [ ] Set SiteBuilder's `NEXTAUTH_URL`, `SITEBUILDER_URL`, and unique
  `SITEBUILDER_NEXTAUTH_SECRET` in its Vercel project; authorize its Google
  OAuth callback URL and verify sign-in independently of Iron Acre Gym.
- [ ] Configure a project-scoped `VERCEL_ACCESS_TOKEN` and
  `VERCEL_PROJECT_ID` (plus `VERCEL_TEAM_ID` for team projects) in SiteBuilder
  to enable self-service custom-domain provisioning; verify DNS with a test
  customer domain before migrating existing domains.
- [ ] Connect separate Vercel projects for `apps/site-builder` and
  `apps/iron-acre-web` to GitHub for preview and production deployments; verify
  each project's environment variables and require the CI check on `main`.
- [ ] Merge the CI workflow from the current draft PR to `main` before expecting
  GitHub Actions to run; workflows are not active on the default branch yet.
- [ ] Add recurring billing, order history/fulfilment, refunds, and webhook
  handling only when those workflows are defined.
- [ ] Configure EnAible SMTP credentials and a verified sender, then test the
  email API and MCP endpoint with a safe recipient before live use.

## Architectural decisions

- EnAIble is a distinct Next.js app and does not replace the gym app.
- The initial EnAIble milestone is Phase 1 only; no agent or invoice workflow
  is claimed complete.
- GCP Firestore access is imported from `@pt/firebase/admin` so unrelated
  consumers of the shared client Firebase barrel do not initialize Admin.
- EnAIble uses NextAuth with a custom Firestore adapter; user and provider
  records are isolated in `enaible_users` and `enaible_accounts`.
- Tenant identity is derived from a signed HttpOnly active-tenant cookie and
  revalidated against the authenticated user's Firestore membership on every
  tenant-scoped request.
- Firestore browser access is denied. Server APIs use Firebase Admin and must
  explicitly enforce tenant ownership and role permissions.
- EnAible email tools send only tenant-approved plain-text templates. API keys
  are domain-scoped, hash-stored and limited to 20 send attempts per key/UTC
  day; email delivery requires SMTP configuration and uses one global sender.

## Known limitations and validation

- `npm ci` and the selected CI checks passed locally with Node.js 22 and npm
  10.8.2. EnAIble's 14 tests, type-check and production build pass; SiteBuilder's
  18 tests, type-check and selected app builds also passed.
- EnAIble is not in the initial deployment CI scope.
- EnAIble OAuth credentials, GCP Firestore permissions, authorized callback
  URLs and deployment have not been configured or verified.
- Authentication supports Google sign-in only. Rate limiting, MFA,
  organisation invitations and member administration are not implemented.
- Email has no unsubscribe or recipient-consent workflow, HTML or attachment
  support, email activity screen, or per-tenant sender identities.
- SiteBuilder payments currently cover one-time Stripe Checkout only. Payment
  receipts are verified on the return page; payment webhooks, order history,
  recurring billing, refunds and fulfillment are not implemented.
- Existing website SMTP configuration and the incomplete gym styling
  migration are outside this EnAIble foundation milestone.
