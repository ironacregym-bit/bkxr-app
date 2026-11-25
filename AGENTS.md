# Repository conventions

- Keep applications isolated under `apps/` and share only implemented,
  reusable code through packages under `packages/`.
- Validate every API input with Zod and return explicit non-success HTTP
  statuses for invalid input, unauthenticated access and denied permissions.
- Never trust a browser-supplied tenant ID. Resolve the Firebase session on
  the server, load the user's membership, and derive role and tenant context
  from persisted data on every tenant-scoped operation.
- Every tenant-owned Firestore document must include `tenantId`, and all
  queries and writes must be constrained to that tenant. Do not rely on
  frontend filtering for isolation.
- Use Firebase Admin only in server code. Never expose service-account
  credentials, provider API keys, or other secrets to browser bundles.
- Treat uploads, extracted text, model output and integration results as
  untrusted. Model output cannot grant permissions or trigger consequential
  actions without deterministic server-side checks and required human approval.
- Firestore client rules deny access by default; change them only with
  tenant-isolation tests and a documented access model.
- Add focused tests for new behavior and run the narrowest relevant tests,
  type checks and build before declaring work complete.
- Keep `BUILD_STATUS.md` and `ARCHITECTURE.md` aligned with implemented
  behavior; document known gaps rather than implying future milestones exist.
- Do not remove legacy gym styles or files until repository-wide references
  confirm they are unused.
