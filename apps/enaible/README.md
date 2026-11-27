# EnAIble

EnAIble is a separate Next.js application in this monorepo. Its foundation
uses NextAuth Google OAuth, the shared GCP Firestore project, organisation
membership and a tenant-scoped dashboard. It also hosts a tenant-scoped email
API and MCP tool endpoint. General agent execution and invoice processing are
not yet implemented.

## Local development

1. In Google Cloud Console, configure an OAuth web client and add
   `http://localhost:3003/api/auth/callback/google` as an authorized redirect
   URI. Add `https://<enaible-domain>/api/auth/callback/google` for production.
   The GCP project must have Firestore enabled, and the service account must
   have permission to access the Firestore database.
2. Copy `.env.example` to `.env.local`. Set the EnAIble OAuth client values,
   the same GCP Firestore project and service-account credentials used by
   SiteBuilder, and separate random secrets of at least 32 characters for
   `ENAIBLE_NEXTAUTH_SECRET` and `ENAIBLE_SESSION_SECRET`. To enable email
   delivery, also configure the SMTP values and a verified `EMAIL_FROM`
   address.
3. From the repository root, install the monorepo dependencies and run
   `npm run enaible:dev`.
4. Open `http://localhost:3003`.

Keep the GCP service-account private key and OAuth client secret server-side.
Do not commit `.env.local` or credential files. No Firebase client
configuration or Firebase Authentication is used. Browser Firestore access is
denied by the root rules; authenticated server APIs use the shared GCP
Firestore project and derive tenant membership from persisted records.

NextAuth user profiles are stored in `enaible_users/{uid}` and the minimal
Google account link is stored in `enaible_accounts`; OAuth access and refresh
tokens are not persisted. Existing profile documents in the legacy `users`
collection are copied to `enaible_users` on first Google sign-in where needed
to preserve the existing user ID and tenant memberships. Organisation
memberships remain under `tenants/{tenantId}/members/{uid}`.

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

The existing endpoint runs wherever EnAIble is deployed; it does not need a
separate Google-hosted MCP server to use GCP Firestore. Configure SMTP and
create a tenant-approved template and API key in **Email & MCP**, then use
the MCP URL and Bearer header above with a compatible client. Test with a safe
recipient before live use. The key permits sends according to the saved policy;
it is not a general-purpose MCP credential.

If you later want Google Cloud hosting, [Cloud Run](https://cloud.google.com/run/docs)
can host an HTTP service, but a Cloud Run deployment for this monorepo has not
been configured or verified. It would need a deployable service image, an
HTTPS endpoint, a least-privilege service identity for Firestore, secure secret
management, SMTP connectivity, and a compatible MCP client. Do not copy
service-account keys or MCP bearer keys into source code.

## Organisation knowledge

Select an organisation on the dashboard and open **Documents** to paste text
or upload a `.txt` file. Owners and administrators can add, search and delete
up to 100 documents per organisation, each limited to 20,000 characters.
Documents are stored under `tenants/{tenantId}/knowledge` with tenant metadata.
The API derives tenant and role from the authenticated session and membership,
not the request body. Search is a basic keyword match over this bounded set;
it is not semantic or vector search. Documents are untrusted content: do not
upload credentials or sensitive personal data.

This is a storage and retrieval foundation only. It is not yet connected to an
agent, workout generator, or MCP knowledge tool, and it does not test model
output for hallucinations. The existing email-only MCP key does not grant
access to knowledge.

## Current limitations

- Google OAuth sign-in is supported; email/password login, MFA, invitations
  and organisation member management are not implemented.
- Email currently supports tenant-authored plain-text templates only. It has
  no attachments, HTML templates, unsubscribe workflow, per-recipient consent
  tracking, send-history UI or provider webhook handling.
- The email API's daily cap is per key; broader rate limiting, abuse controls,
  retention policies and production deployment configuration remain
  outstanding.
- Dashboard activity and usage cards are empty-state scaffolding; no agent or
  workflow execution is implemented yet.
