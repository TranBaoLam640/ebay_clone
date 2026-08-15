# Repository Reorganization Audit

Date: 2026-07-21.

## Layout correction

The backend originally lived at repository root. The first reorganization moved it into `backend/` but incorrectly created root-level `docs/`, `infrastructure/`, project documentation, and ignore files.

The corrected final visible root layout is:

```text
backend/
frontend/
```

The hidden `.git/` remains at repository root. Documentation and infrastructure placeholders now live inside `backend/`; root documentation was moved or merged, and no root application/configuration files remain.

## Moves and cleanup

- Kept source, tests, package/lock files, backend configuration, `.env.example`, and the ignored local `.env` under `backend/`.
- Moved `AGENTS.md` and `PROJECT_CONTEXT.md` into `backend/`.
- Moved the complete `docs/` tree into `backend/docs/` without deleting historical audit content.
- Moved all User 6 placeholders into `backend/infrastructure/`; Mongoose models remain in `src/modules/` and seed/check scripts remain in `src/scripts/`.
- Merged useful project overview, scope, folder, and command information from root README into `backend/README.md`, then removed root README.
- Moved ignore rules into `backend/.gitignore` and `frontend/.gitignore`, then removed root `.gitignore`.
- Removed generated root `coverage/` and the obsolete root `node_modules/`; dependencies were installed only from `backend/`.
- Frontend remains only an uninitialized README and `.gitignore` placeholder.

## Verification

- Corrective pre-move baseline: 69 tests across 5 files passed from `backend/`.
- Final tests: 69 tests across 5 files passed.
- Final coverage: 87.69% statements/lines, 83.29% branches, and 93% functions; output is under ignored `coverage/`.
- Previous full lint: ESLint passed; Prettier reported 86 pre-existing mismatches. Final lint still has no ESLint errors and reports 85 pre-existing Prettier mismatches after root-only files were removed/moved; unrelated files were not formatted.
- `npm run db:check`: passed; safe metadata retrieval and disconnect succeeded, while the server did not report a replica-set name.
- Runtime smoke tests for `/health`, `/ready`, `/api/v1/categories`, and `/api/v1/products?page=1&limit=20` passed.
- Seed is intentionally not run because it deletes/recreates deterministic fixture IDs on the configured remote database.

## Safety

- No business logic, API route, database pool setting, readiness behavior, or graceful shutdown flow was redesigned.
- Durable business data remains in MongoDB; no in-memory repository, local business persistence, MemoryStore, second connection, or sticky-session dependency was added.
- The local `.env`, dependencies, coverage, logs, and build output remain ignored; no credential is copied into tracked files.

## Known remaining issues

- Existing backend files retain their pre-existing Prettier mismatches; unrelated source is intentionally not reformatted.
- The configured MongoDB server previously did not report a replica-set name, so transaction-dependent flows still require suitable server topology.
- Frontend and infrastructure remain placeholders.
