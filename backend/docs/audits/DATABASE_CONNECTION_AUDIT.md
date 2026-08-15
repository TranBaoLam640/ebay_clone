# Database Connection Audit

Updated: 2026-07-21.

Repository note: backend files are under `backend/` without database or business-logic redesign. Paths below are relative to the backend working directory; commands run after `cd backend`.

- Files changed: `.env.example`, `package.json`, `src/config/env.js`, `src/config/database.js`, `src/config/mongodb-uri.js`, `src/server.js`, `src/scripts/seed.js`, `src/scripts/check-database.js`, `tests/unit/mongodb-config.test.js`, `README.md`, `PROJECT_CONTEXT.md`, and this audit.
- URI selection: a non-empty `MONGODB_URI` takes precedence; otherwise config builds one URI from validated component variables. Credentials are encoded with `encodeURIComponent`; only configured `authSource`, `replicaSet`, and `tls=true` options are added.
- Credential protection: no real credentials are stored in source/docs; database logs contain only safe target metadata; check output omits URIs and secrets; `.env` remains ignored.
- Unit tests: 9/9 pass; complete suite is 69 tests across 5 files after adding them.
- Lint: ESLint and targeted formatting checks pass for current changes. Full backend lint remains nonzero on 85 pre-existing Prettier mismatches after the final layout correction.
- Coverage: post-move run completed at 87.69% statements/lines, 83.29% branches, and 93% functions; artifacts are under ignored `coverage/`.
- `db:check`: passed after relocation using the ignored `.env`; ping, safe metadata retrieval, and disconnect succeeded without exposing credentials. The server did not report a replica-set name.
- Replica set: transaction-based auth/address/notification/review/feedback flows require a replica set or sharded cluster; transactions were not removed for standalone compatibility.
- Manual configuration remaining: copy `.env.example` to `.env`, choose full URI or component mode, supply application secrets, permit only required client IPs through firewall/bind settings, create a least-privilege database user, and ensure advertised replica-set member hosts are reachable.
