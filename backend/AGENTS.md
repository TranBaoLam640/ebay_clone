# Repository instructions

## Runtime and setup

- The Git root contains only `backend/` and the frontend placeholder. This file is inside the single ESM npm package; run commands from `backend/`.
- Use Node.js 20+ and npm.
- Copy `.env.example` to `.env` before importing application code. Configuration is validated at import time; `MONGODB_URI`, `CLIENT_ORIGIN`, and 32+ character JWT access, JWT refresh, and CSRF secrets are mandatory.
- Runtime MongoDB must be a replica set or sharded cluster because core flows use transactions. A standalone `mongod` is insufficient.
- `src/server.js` is the process entrypoint; `src/app.js` exports the Express app used by integration tests. `/health` and `/ready` are outside the configurable API prefix.

## Commands

- `npm run dev`: start with Node watch mode.
- `npm start`: start once.
- `npm test`: run all Vitest suites once.
- `npm test -- tests/integration/foundation.test.js`: run one file.
- `npm test -- tests/integration/foundation.test.js -t "02 ready200"`: run one named test.
- `npm run test:watch`: Vitest watch mode.
- `npm run test:coverage`: write V8 coverage artifacts under `coverage/`.
- `npm run lint`: run both ESLint and the non-mutating Prettier check. There is no separate typecheck.
- `npm run format`: rewrite files; do not use it as a verification-only command.
- `npm run seed`: recreate deterministic fixtures after deleting records with its fixed fixture IDs; do not run it against data that must be preserved.
- After changes, run focused tests where possible, then the full relevant suite and `npm run lint`.

## Architecture constraints

- Preserve the module flow: routes -> controllers -> services -> repositories -> Mongoose models. Repositories are the normal model-access boundary; `src/scripts/seed.js` is an explicit exception.
- Keep durable business, session, and revocation state in MongoDB. Do not add process-local collections or globals; the service is designed to run without sticky sessions.
- Public `sellerId` values refer to `SellerProfile` IDs, not User IDs.
- Orders expose only the minimal read-only eligibility contract used by reviews and seller feedback. Do not infer a general order creation or lifecycle API.
- Review/product-rating and feedback/seller-rating mutations must remain in the same MongoDB transaction, with aggregates recalculated from persisted records.
- Auth credentials remain HttpOnly cookies. Every unsafe request beneath the API prefix requires a CSRF token; `GET /auth/csrf-token` is the sole global CSRF bypass.

## Test conventions

- Integration suites start their own `MongoMemoryReplSet`, replace `MONGODB_URI`, and import the app only afterward. File-level parallelism is intentionally disabled; setup may take up to 10 minutes while MongoDB is obtained/started.
- For unsafe requests, use a persistent Supertest agent, fetch `/api/v1/auth/csrf-token`, retain its cookies, and send the token as `x-csrf-token`.
- Registration does not return verification OTPs. Tests spy on `emailService.sendVerificationEmail` and capture the outbound OTP.
