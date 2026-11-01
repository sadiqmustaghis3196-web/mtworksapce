# MT Nexus Global

React/Vite frontend and Express/PostgreSQL/Prisma ERP rebuild. **Implementation is in progress; this is not a completed ERP release.**

See [progress and resume checkpoint](docs/DEVELOPMENT_PROGRESS.md), [implementation map](docs/PROJECT_STRUCTURE.md), [screens](docs/SCREEN_FILE_MAP.md), [API reference](docs/API_ENDPOINTS.md), and [Roman Urdu lesson](docs/lessons/01-foundation.md).

## Requirements

Node 22.12+; npm; PostgreSQL 16. Prisma requires HTTPS access to `binaries.prisma.sh` with checksum and TLS verification enabled.

```sh
# Repository root
npm ci
cd server
npm ci
npm run prisma:generate
```

The current cloud policy blocks the last command. The domain addition has been saved in environment settings but must be applied before database setup can proceed. No database migration or backend integration test has passed yet.

## Local configuration and startup

Copy `server/.env.example` to `server/.env` and set DATABASE_URL to your **development** database. The cloud's loopback-only PostgreSQL container uses `postgresql://mtdev@127.0.0.1:5432/mtdev`. This trust-authenticated database must never be exposed publicly or used in production.

Database schema changes are awaiting a generated and reviewed baseline migration. Do not apply them to an existing production database. Once the network blocker is resolved, generate the migration, apply it to the local development database, run `npm run seed` for reference roles/permissions, and execute the new integration suite before calling the API ready.

Provision the first administrator with `npm run provision-admin` in `server/`, supplying INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD securely in that process. Password requires 12+ characters with uppercase/lowercase/number. No default account is created. Remove provisioning variables after use.

After schema setup:

```sh
# terminal 1: server/ (loads server/.env)
npm start
# terminal 2: repository root (Vite proxies /api to port 5000)
npm run dev
```

Frontend port 8000, API port 5000. Production requires HTTPS, NODE_ENV=production, and exact APP_ORIGINS; the Vite dev server is not a production deployment server. Password reset delivery requires SMTP configuration and PUBLIC_APP_URL; no mail has been sent or delivery verified during this task.

## Checks

- `npm run build`: React production bundle.
- `npm test`: workflow, CSRF, permission and scope unit tests.
- `npm run test:ui`: start Vite on port 8001 first (`npm run dev -- --port 8001`); Chromium UI tests use API fixtures and **do not validate database persistence**. Playwright config uses `/usr/bin/chromium` in this cloud; select an installed browser on other machines.
- `cd server && npm run test:integration`: new DB-backed auth/task suite, **not run yet**. Use only a disposable development database.
- Historical server tests expect removed fixed accounts/data and JWT bearer responses. They are preserved as legacy test references, not evidence for the new session architecture.

`docs/legacy/` contains historical reports. Their completion claims and old file references do not describe the rebuild. `scripts/start_dev.sh` and `scripts/serve.py` are historical helpers; use the commands above until the unified Linux startup helper is validated.
