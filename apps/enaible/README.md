# EnAIble

EnAIble is a separate Next.js application in this monorepo. Its foundation
provides Firebase Authentication, server-verified sessions, organisation
membership and a tenant-scoped dashboard. It also hosts a tenant-scoped email
API and MCP tool endpoint. General agent execution and invoice processing are
not yet implemented.

## Local development

1. In Firebase Console, enable the Email/Password and Google sign-in providers
   under **Authentication → Sign-in method**, and add localhost plus the
   deployed EnAIble domain to **Authorized domains**. Google sign-in uses
   Firebase's existing web configuration; no separate Google OAuth secret is
   needed in EnAIble's environment.
2. Copy `.env.example` to `.env.local` and fill in the Firebase web
   configuration, Firebase Admin service-account values and a random
   `ENAIBLE_SESSION_SECRET` of at least 32 characters. To enable email
   delivery, also configure the SMTP values and a verified `EMAIL_FROM`
   address.
3. From the repository root, install the monorepo dependencies and run
   `npm run enaible:dev`.
4. Open `http://localhost:3003`.

Firebase Admin credentials must remain server-side. Do not commit `.env.local`
or service-account keys. All browser Firestore reads and writes are denied by
the root Firestore rules; application data access must go through authenticated
server APIs that derive tenant membership from the session. Verified Firebase
identities are mirrored to `enaible_users/{uid}` with their user ID, email,
display name and timestamps. Passwords and OAuth credentials are not copied
into Firestore; organisation memberships remain under
`tenants/{tenantId}/members/{uid}`.

## Email API and MCP

The shared `@pt/email-engine` package contains the SMTP sender and a
server-to-server email API client. EnAible hosts the API at
`/api/email/send` and a stateless Streamable HTTP MCP endpoint at `/api/mcp`.
Both accept the same per-organisation Bearer API key.

An organisation owner or administrator creates approved plain-text templates
and scoped API keys under **Email & MCP** in the EnAible dashboard. Saving a
template is the human approval step: agents can choose only an existing
template and supply its declared placeholder values, not arbitrary subjects,
HTML, or message bodies. Keys are limited to exact recipient domains, have a
20-attempt-per-UTC-day cap (failed SMTP attempts count), and can be revoked.
The raw key is shown once; only its hash is stored in Firestore.

Apps can call the API with `sendApprovedEmail` from
`@pt/email-engine/client` using server-side configuration:

```ts
await sendApprovedEmail({
  serviceUrl: process.env.ENAIBLE_EMAIL_SERVICE_URL!,
  apiKey: process.env.ENAIBLE_EMAIL_API_KEY!,
  templateId,
  to,
  variables,
  idempotencyKey,
});
```

External MCP clients connect to `https://<enaible-host>/api/mcp` and send
`Authorization: Bearer <organisation-api-key>`. Configure that header in the
client's server-side MCP settings; never put the key in browser code or source
control. The endpoint currently uses scoped static Bearer keys rather than
OAuth discovery, so the selected MCP client must allow a custom authorization
header. Email sends use EnAible's server-side SMTP settings and global
`EMAIL_FROM` identity.

## Current limitations

- Firebase Email/Password and Google sign-in are supported; password recovery,
  MFA, invitations and organisation member management are not implemented.
- Email currently supports tenant-authored plain-text templates only. It has
  no attachments, HTML templates, unsubscribe workflow, per-recipient consent
  tracking, send-history UI or provider webhook handling.
- The email API's daily cap is per key; broader rate limiting, abuse controls,
  retention policies and production deployment configuration remain
  outstanding.
- Dashboard activity and usage cards are empty-state scaffolding; no agent or
  workflow execution is implemented yet.
