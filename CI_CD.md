# CI/CD

## What is automated in the repository

`.github/workflows/ci.yml` runs for pull requests targeting `main`, pushes to
`main`, and manual workflow dispatch. It uses Node.js 22 and the root
`package-lock.json`, then:

- runs SiteBuilder's unit tests and type-check;
- builds SiteBuilder; and
- builds the Iron Acre public website.

The workflow uses read-only repository permissions and requires no production
credentials. Keep Firebase service-account keys, OAuth secrets, Stripe keys,
Vercel tokens, and SMTP credentials out of GitHub Actions.

## Vercel deployments

Use Vercel's Git integration for continuous deployment. Create or connect one
Vercel project per app; both should use this repository and the `main`
production branch:

| Vercel project | Root Directory | Production branch |
| --- | --- | --- |
| SiteBuilder | `apps/site-builder` | `main` |
| Iron Acre public website | `apps/iron-acre-web` | `main` |

Enable preview deployments for pull requests. Vercel should build each app
from its workspace package and use the repository's npm workspace lockfile.
Confirm the Vercel build/install settings include the monorepo workspace
packages outside the app root. Do not configure deployments for
`apps/iron-acre-app` or `apps/enaible` yet.

Vercel project linking and environment settings are external to this
repository and must be completed in the Vercel dashboard. The repository
cannot confirm whether these projects are already linked.

### SiteBuilder environment

Set the production and preview values as appropriate for each environment:

- `NEXTAUTH_URL` and `SITEBUILDER_URL` to the canonical SiteBuilder origin;
- `SITEBUILDER_NEXTAUTH_SECRET` as a unique SiteBuilder-only secret;
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, with the deployed
  `/api/auth/callback/google` URL allowed in Google OAuth settings;
- Firebase Admin `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`, and
  `GOOGLE_PRIVATE_KEY` (or the supported `FIREBASE_*` equivalents);
- `VERCEL_ACCESS_TOKEN` (or `VERCEL_TOKEN`), `VERCEL_PROJECT_ID`, and
  `VERCEL_TEAM_ID` when using a Vercel team, to enable custom-domain APIs; and
- Stripe and SMTP values only if those integrations are being enabled.

All service-account keys and API tokens must remain server-side. Verify that
the service account has the required Firestore IAM access before testing
sign-in or site management.

### Iron Acre public website environment

- Set `NEXT_PUBLIC_SITE_URL` to the public website origin.
- Set `IRON_ACRE_NOTIFY_EMAIL` or `EMAIL_SERVER_USER` and the SMTP settings
  needed by lead-email notifications.
- Set `IRON_ACRE_PROGRAM_URL` if the coaching flow needs a program link.

Only add variables the selected app actually needs. Never copy gym-app or
SiteBuilder secrets into the public website project unless its server-side
code requires them.

## Release flow

1. A pull request opens a Vercel preview for each linked project and runs the
   GitHub Actions checks.
2. Review the preview and require the `SiteBuilder and marketing website`
   CI check to pass before merging.
3. Merging to `main` triggers Vercel production deployments for the linked
   SiteBuilder and marketing projects.
4. Verify each deployment's health, authentication, and key user paths. Keep
   the existing SiteBuilder deployment available while customer domains are
   moved one at a time.

Configure GitHub branch protection for `main` to require the CI check. This
repository change adds the workflow but cannot enable branch protection or
connect Vercel projects on the user's behalf.

## Limitations

- The GitHub Actions checks cover SiteBuilder and the public marketing site
  only. The other two applications are not included in this initial rollout.
- Vercel project creation/linking, domain assignment, production branch
  settings, environment variables, and branch protection are dashboard
  actions that still need to be verified.
- No production deployment or customer-domain cutover is performed by the CI
  workflow.
