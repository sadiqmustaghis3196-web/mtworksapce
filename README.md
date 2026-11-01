# MT Nexus Global

React/Vite frontend and Express/PostgreSQL/Prisma ERP rebuild. **Implementation is in progress; this is not a completed ERP release.**

See [progress and resume checkpoint](docs/DEVELOPMENT_PROGRESS.md), [implementation map](docs/PROJECT_STRUCTURE.md), [screens](docs/SCREEN_FILE_MAP.md), [API reference](docs/API_ENDPOINTS.md), and [Roman Urdu lesson](docs/lessons/01-foundation.md).

## UI design preview — current Vercel mode

Database work is deferred at the user's request. The default Vercel deployment is now a static UI preview with sample data and a public code-based test login:

- Email: `admin@mtnexus.test`
- Password: `NexusUI@2026!`

Run `npm ci` then `npm run dev:preview` locally. Vercel uses `npm run build:preview` and the root directory. No database, Prisma engines or environment credentials are needed for this mode. The UI is visibly labeled UI PREVIEW. Changes stay in this browser only; reset them with Reset sample data. This is not real authentication or a completed ERP.

The real backend is unchanged by the preview login. `npm run build:production` uses the real API; `npm run prepare:production` restores the full-stack Vercel config/adapter for the later database phase. See [deployment instructions](docs/VERCEL_DEPLOYMENT.md).

## Real backend requirements — later phase

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
- `npm run test:ui`: start Vite on port 8001 first (`npm run dev:production -- --port 8001`); Chromium UI tests use API fixtures and **do not validate database persistence**. Playwright config uses `/usr/bin/chromium` in this cloud; select an installed browser on other machines.
- `cd server && npm run test:integration`: new DB-backed auth/task suite, **not run yet**. Use only a disposable development database.
- Historical server tests expect removed fixed accounts/data and JWT bearer responses. They are preserved as legacy test references, not evidence for the new session architecture.

`docs/legacy/` contains historical reports. Their completion claims and old file references do not describe the rebuild. `scripts/start_dev.sh` and `scripts/serve.py` are historical helpers; use the commands above until the unified Linux startup helper is validated.

## Vercel

See [Vercel deployment instructions](docs/VERCEL_DEPLOYMENT.md). Current default: static UI preview. Hosted PostgreSQL, Prisma generation and account provisioning apply only after restoring the full-stack configuration for the later database phase.

## Working software-house workflows

Previously unavailable module screens are now implemented in the browser-local workspace: clients/contacts/projects, recruitment to employee onboarding, employee documents, attendance/leaves, internship reviews, invoice/payment ledgers and payroll approvals, creative review with linked board tasks, CRM conversion, support, departments and preview account/permission administration. Search, filters, pipeline views, history, notifications, CSV export and Settings → workspace JSON backup are included.

See [workflow guide](docs/WORKFLOWS.md), [current checkpoint](docs/DEVELOPMENT_PROGRESS.md) and [Roman Urdu lesson](docs/lessons/03-module-workflows.md). `npm run test:workflows` tests business rules; `npm run test:preview` checks the built browser app on port 8002. These are working local workflows, **not completed server/database integrations**. No email, bank transfer or real user account is created by preview actions.

## Professional operations interface

Domain-specific overviews, linked watchlists, recruitment funnels, client/employee/project profiles, structured invoice documents, payroll breakdowns and inline ticket conversations replace the earlier generic-only views. Contextual forms inherit their client/invoice links, suggest values and show live totals. Use Ctrl/Command+K for the current-view search. Theme choice persists. `npm run test:insights` covers the read models and form calculations; the browser suite now contains 25 passing checks. See the [design/workflow lesson](docs/lessons/04-professional-operations.md).
