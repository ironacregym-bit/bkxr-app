# Project portfolio and SiteBuilder migration

**Last reviewed:** 26 November 2026
**Repository:** `ironacregym-bit/bkxr-app`
**SiteBuilder pull request:** [#1 — Move SiteBuilder into its own Turbo app](https://github.com/ironacregym-bit/bkxr-app/pull/1) (open draft)

This document describes what is currently in the repository and a safe route
for deploying the separate SiteBuilder app and moving existing customer sites.
It distinguishes implemented code from work that still needs configuration,
testing, or production verification.

## Project at a glance

The repository is an npm-workspaces/Turborepo monorepo. It contains four
Next.js applications and shared packages:

| App | Location | Purpose |
| --- | --- | --- |
| Iron Acre public website | `apps/iron-acre-web` | Marketing, local service pages, pricing, lead capture, and the seven-day workout. |
| Iron Acre member app | `apps/iron-acre-app` | Member and coach experiences for workouts, nutrition, bookings, subscriptions, notifications, and gym operations. |
| SiteBuilder | `apps/site-builder` | Admin/editor and hosted-site platform, with Stripe payments and the new custom-domain onboarding work. |
| EnAIble | `apps/enaible` | Early multi-tenant SaaS foundation, including organisation membership and approved-email API/MCP integration. |

The root `SiteBuilder/` directory still exists alongside the new app. Treat
it as legacy material until repository references and deployment configuration
have been checked; it has not been removed as part of this migration.

## Application inventory

### Iron Acre public website

**Location:** `apps/iron-acre-web`

- Public marketing pages for outdoor gym training, functional strength,
  boxing, online coaching, prices/times, and a seven-day starter workout.
- Responsive navigation, page metadata, sitemap, and robots routes.
- Lead and coaching enquiry API routes.
- Shares the email-engine package for supported email workflows.

### Iron Acre member and gym app

**Location:** `apps/iron-acre-app`

- Existing member and coach application built with Next.js Pages Router,
  NextAuth, Firebase/Firestore, and Stripe integrations.
- Member-facing workout, completion, progress, nutrition, meal-plan,
  recipes, habits, supplements, and booking capabilities.
- Admin workflows for members, classes and recurring timetables, programs,
  workouts, check-ins, and notifications.
- Includes billing, referrals, exercise/boxing content, and integrations.
- Has AI workout generation and a workout/agent workflow surface. The workout
  builder uses existing gym-specific data and is **not yet tenant-safe for
  reuse in EnAIble**.
- Tailwind/shadcn styling migration is ongoing. Do not remove legacy gym
  styles until repository-wide references confirm they are unused.

### SiteBuilder

**Location:** `apps/site-builder`

- Separate Turbo workspace with its own NextAuth settings and auth cookies;
  it does not share the gym app's redirect policy or secret.
- Site creation remains restricted to persisted SiteBuilder/admin access.
  Authenticated site owners/editors can edit site content and manage editors.
- Public pages resolve by site slug and can be served on configured custom
  hosts.
- Stripe Connect onboarding and one-time Stripe Checkout for site products.
  Checkout prices and connected accounts are resolved server-side. Recurring
  billing, order fulfilment, refunds, and order history are not implemented.
- Custom-domain onboarding is implemented on the PR branch: it calls the
  Vercel Projects API, displays recommended DNS targets, requires an
  app-specific DNS TXT ownership challenge plus Vercel verification, then
  activates a Firestore host mapping. Legacy `SITEBUILDER_HOSTS_JSON`
  mappings remain supported while migrating.
- A new customer's site/domain flow does not require adding a per-customer
  environment-variable mapping. The deployment still needs server-side Vercel
  credentials and Firebase access.

### EnAIble

**Location:** `apps/enaible`

- Separate early-stage SaaS app with Firebase email/password authentication,
  server-verified HttpOnly sessions, organisation selection, and
  Firestore-backed membership/role checks.
- Tenant-scoped email templates and API keys, an email send API, and a
  Streamable HTTP MCP endpoint for sending only owner-approved plain-text
  templates.
- API keys are hash-stored, domain-scoped, revocable, idempotency-aware, and
  capped at 20 send attempts per key per UTC day.
- Tenant identity and permissions are revalidated server-side; browser
  Firestore access is denied by default.
- This is a foundation, not a finished AI-agent platform. General agent
  execution, workflow engine, invoice processing, invitations, member
  administration, and production hardening remain outstanding.

## Shared packages and architecture

- `packages/firebase`: shared Firebase Firestore functionality, with a
  separate Firebase Admin entry point to avoid initializing privileged server
  code in ordinary consumers.
- `packages/email-engine`: reusable SMTP sending and server-to-server client,
  with approved-email helpers.
- `packages/agents`, `packages/AgentTools`, and `packages/workflow-engine`:
  existing reusable agent/runtime and workflow-related code. Their presence
  does not mean EnAIble's general agent product is complete or that gym
  workflows are tenant-safe.
- `packages/capture-engine`, `packages/types`, and
  `packages/shared-types`: capture and shared TypeScript utilities.
- Root Firestore rules deny browser access. Server APIs use Firebase Admin
  and must still enforce authentication, tenant ownership, and permissions.

## Work completed and current status

- Established the Turbo workspace structure and separated SiteBuilder into
  `apps/site-builder`.
- Built out SiteBuilder's independent authentication configuration and
  cross-origin redirect restrictions.
- Implemented SiteBuilder Stripe Connect and secure one-time checkout
  foundations.
- Implemented server-side Vercel domain attachment, DNS-target retrieval,
  per-site DNS ownership challenges, verification, tenant-scoped routing, and
  UI for DNS setup. Existing static host configuration remains a migration
  path.
- Added EnAIble's separate authentication, tenant-membership, default-deny
  Firestore, and approved-email/MCP foundation.
- Added public Iron Acre marketing and service pages.
- Added a root npm lockfile and initial GitHub Actions checks for SiteBuilder
  and the Iron Acre public website; updated all apps to Next.js 14.2.35 and
  corrected monorepo output-tracing configuration.
- Updated architecture, build-status, and environment-example documentation.

**Important current-state qualifications**

- PR #1 is an **open draft**, not merged. The self-service domain changes are
  on that PR branch and are not yet in `main`.
- The selected CI checks passed locally: SiteBuilder's 18 tests and
  type-check, plus production builds for all four apps. Type-checks for the
  other two apps also passed. One existing EnAIble tenant-cookie test fails;
  EnAIble is outside the initial deployment CI scope.
- A previous SiteBuilder sign-in attempt reported Firebase Firestore
  `PERMISSION_DENIED`. Confirm the service account, project, and IAM access
  before relying on live authentication, site lookup, or domain operations.
- Vercel/Firebase/Google OAuth/Stripe settings are environment-specific;
  repository code alone does not configure or verify production.
- No automated bulk customer-site or Firestore migration has been implemented.

## Monday plan: deploy SiteBuilder and migrate customer sites

Use this as a staged migration, not a same-day DNS cutover for every customer.
Keep the existing SiteBuilder deployment available until each migrated site
passes verification.

### 1. Before changing production

1. Review PR #1 and confirm the GitHub Actions CI check passes; its
   dependency installation, SiteBuilder tests/type-check/build, and marketing
   website build have passed locally. Resolve any CI failures before
   production deployment.
2. Confirm Firebase Admin credentials point to the intended Firestore
   project and that the service account has the required access. Test the
   existing Firestore permission failure first.
3. Inventory customer sites: site ID, tenant ID, slug, owner/editors,
   published state, current hostname(s), registrar/DNS provider, and current
   production project. Confirm customer records exist and take a recoverable
   backup/export before changes.
4. Record the current Vercel project, environment variables, domains, and
   `SITEBUILDER_HOSTS_JSON` mappings. Do not delete the old project or
   environment mappings during initial rollout.

### 2. Deploy the new app separately

1. After review and validation, merge PR #1 and create/configure a separate
   Vercel project connected to this repository with the app root set to
   `apps/site-builder`. Keep the old SiteBuilder deployment intact.
2. Configure the new project's server-side environment: canonical
   `NEXTAUTH_URL` and `SITEBUILDER_URL`, a unique
   `SITEBUILDER_NEXTAUTH_SECRET`, Google OAuth credentials and callback,
   Firebase Admin project/service-account credentials, and required
   application settings.
3. To enable custom domains, set a project-scoped `VERCEL_ACCESS_TOKEN` (or
   `VERCEL_TOKEN`), `VERCEL_PROJECT_ID`, and `VERCEL_TEAM_ID` if applicable.
   Keep these values server-only. Configure Stripe settings if validating
   checkout.
4. Verify Google sign-in, persisted admin access, Firestore reads/writes,
   site editing, and preview/public rendering on the new deployment before
   changing customer DNS.

### 3. Migrate one customer at a time

1. Confirm the new app reads the expected existing site and tenant records.
   SiteBuilder's site creation is still restricted; do not assume public
   self-service signup is available.
2. For each hostname, check whether it is covered by a legacy static mapping
   or needs the new custom-domain flow. Attach/provision and verify it against
   the new Vercel project; add the app-specific TXT record and any Vercel
   verification records shown in the dashboard.
3. Update DNS only after the new project is ready for that hostname. Avoid
   conflicting A and CNAME records. Allow DNS propagation and verify that
   HTTPS, the correct customer site, assets, and important paths work.
4. Test customer sign-in/editor access, publishing, and any payment path used
   by that customer. Retain the old deployment and a rollback route until the
   customer confirms success.
5. Continue to the next hostname only after the previous one is healthy.
   Remove old host mappings/projects only after all domains and customers
   have been confirmed and a rollback is no longer needed.

**Do not assume "merge the other sites over" means merging deployments or
Firestore records automatically.** The new app can host multiple sites through
Firestore site records and hostname mappings, but each site's data, custom
domain ownership, DNS cutover, permissions, and any payment configuration
must be checked. There is no bulk migration script in the repository today.

## Interview-ready summary

> I worked on evolving a set of related web products into a Turborepo
> monorepo with distinct applications and shared packages. I separated
> SiteBuilder from the gym application, gave it an independent authentication
> boundary, and built the foundations for Stripe Connect payments and
> customer-managed custom domains. The domain flow provisions through
> Vercel's API, gives customers the DNS records they need, proves domain
> ownership with a per-site TXT challenge, and activates tenant-scoped routing
> only after verification. I also established EnAIble as a separate
> multi-tenant SaaS foundation with server-verified Firebase sessions,
> membership-derived authorization, and a constrained approved-email API/MCP
> integration. I documented the remaining production and migration work
> honestly: the SiteBuilder PR is still a draft, deployment credentials and
> Firebase IAM need verification, and the customer-site cutover is staged
> rather than an automated bulk move.
