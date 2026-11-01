# Active priority: UI preview before database work

The latest user instruction explicitly requests temporary credentials in frontend code for UI testing and defers database work. This supersedes the earlier no-demo requirement only for the current design-preview phase. The original complete ERP specification remains the longer-term goal.

Current default Vercel deployment: root static Vite UI preview (`npm run build:preview`), no API function, no server install, no Prisma or DB prerequisites. Test login: admin@mtnexus.test / NexusUI@2026! (public preview credentials, not a real user/account). Sample data and preview API are isolated in src/preview/; real server authentication is not modified. Preview browser session and edits use separate local/session storage keys. Visible UI PREVIEW notice and reset controls distinguish it from the real backend.

Later full-stack configuration is retained in deployment/vercel.production.json and deployment/production-api.js. npm run prepare:production restores the original deployment files. Explicit npm run build:production compiles real API mode; normal npm run build now defaults to preview as well. Never treat preview workflow checks as database or authorization integration tests. Do not provision a real account or ask the user for database setup as a prerequisite to UI design work now.

Full task history and outstanding ERP work follow below.

---

# Implementation checkpoint

Specification: full ERP rebuild supplied November 1, 2026. Screenshot is the design reference.

## Audit
- Existing `server/` is the sole backend; retain it to avoid a duplicate application root.
- PostgreSQL 16 container is available. npm backend dependencies install successfully.
- Prisma generation is blocked by an HTTP 403 from the environment policy for binaries.prisma.sh. Do not bypass checksums or TLS checks.
- Existing schemas cover organizations, employees, projects/tasks, clients, attendance, payroll, recruitment, leads, tickets. They lack persistent sessions and several requested detail models.
- Existing JWT revocation is process-local, project reads are public, role permissions are hardcoded, and SMTP delivery is a stub.
- Existing docs reference frontend files that were absent at checkout.

## Milestone map and dependencies
| Milestone | Work | Required evidence |
|---|---|---|
| 1 Audit | Inspect source, reconcile routes/models, preserve existing work | This checkpoint |
| 2 Database | Versioned migrations, normalized missing models, local DB configuration | Prisma validate, migrate, relational integration tests |
| 3 Authentication | DB sessions, CSRF, password reset delivery, secure provisioning | Cookie/login/logout/reset/restart tests |
| 4 Authorization | Stored permissions, record scope, users/role management | Cross-user/department isolation tests |
| 5 Shell/dashboard | React/Vite, responsive screenshot styling, real DB metrics | Build, API metrics, responsive browser checks |
| 6 Boards | Six stages, collapsed rails, shared modal, four views | Persistence and forbidden-transition tests |
| 7 Clients | Directory, contacts, history, project links | Authorized CRUD |
| 8 Hiring | Jobs/applications/interviews/evaluations | Pipeline integration |
| 9 Employees | Profiles, managers, documents, onboarding | Authorized CRUD |
| 10 Attendance | Check-in/out, timesheets, leave approvals/balances | Duplicate check-in + approval tests |
| 11 Internships | Programs/enrollments/mentors/evaluations | Enrollment/progress persistence |
| 12 Finance | Decimal invoices/payments/expenses/payroll approval | Calculation and authorization tests |
| 13 Creative | Briefs/assets/revisions/approvals | Revision history + upload tests |
| 14 CRM | Leads/opportunities/activities/conversion | Conversion transaction tests |
| 15 Support | Tickets/comments/attachments/SLA | Resolution/reopen workflow |
| 16 Departments | Members/managers/project workload | Scope and integration tests |
| 17 QA/docs | Security, all viewport sizes, Roman Urdu lessons | End-to-end evidence; no untested completion claims |

## Resume
Use /workspace/mtworksapce; do not create another application root. Read this file and git diff first. Apply the saved network change for binaries.prisma.sh, rerun Prisma generation, then migrations and API integration tests. No application module is yet declared complete. Never substitute localStorage data for database-backed records or advertise placeholder modules as working.

## Current implementation checkpoint (November 1, 2026)

### Implemented, with limited verification
- Root React/Vite app; single Express backend in server/. Historical root reports moved to docs/legacy; old standalone password-reset HTML and unused JWT revocation code removed.
- Screenshot-inspired navy/purple/cyan shell, role-aware sidebar, mobile overlay, search, profile/logout, theme switch.
- Six-column board with collapsed rails, category/project filters, shared task dialog; list, due-date grouping and basic timeline. Full month calendar and proportional timeline still pending.
- API-based task creation/edit/comment/transition UI; dialog reads checklists/attachments but cannot yet edit/upload them.
- Persistent Session and TaskActivity schema additions; opaque hashed sessions, expiry/logout/password-change revocation code. Not database-tested.
- Stored permission-derived UI capabilities; organization/project/assignment/department task filters. Complete configurable scope engine and admin matrix remain pending.
- Guarded sequential task transitions, reviewer checks, required rejection reason, atomic history/optimistic stage check; no deletion during movement. PATCH cannot change stage or project/department.
- Internal account administration rewritten with organization scope, privilege-grant checks and session revocation. Not database-tested.
- Real SMTP reset transport with enforced TLS, one-time hashed tokens and generic public responses. SMTP configuration/delivery is unverified; no reset email was sent.
- Safe reference seed: 12 role names and permissions, no users or preset passwords. INITIAL_ADMIN_* operator command is the only initial admin provisioning route.
- Dashboard endpoint derives task/project counts and deadlines from authorized DB queries. Not database-tested.

### Actual validation
- npm ci (original backend), npm installs (new dependencies): passed.
- PostgreSQL 16.15 container starts and executes SQL: passed during onboarding.
- npm run build: passed after latest frontend changes.
- Direct unit tests: 6 security/permission/scope tests + 5 transition tests passed.
- Chromium: 8 tests passed. Login at widths 320, 375, 390, 430, 768, 1024, 1440; board page overflow checks at all seven widths, review/approve controls, collapsed columns, modal Escape/focus, mobile overlay close. API fixtures only; not DB or authorization integration evidence.
- npm run prisma:generate: blocked with HTTP 403 fetching verified checksum from binaries.prisma.sh.
- npm start (server): failed because Prisma client is ungenerated, confirming required runtime blocker.
- New server/test/rebuild.integration.js prepared but **unrun**. Existing historical tests use obsolete fixed demo identities and JWT semantics; not passing coverage.
- No schema migration generated/applied; no production readiness or complete-module claim.

### Exact next actions
1. Apply the saved binaries.prisma.sh network allowance in environment settings; current runtime policy still lacks the domain.
2. From server/, run npm run prisma:generate. Keep checksum and TLS verification on.
3. Generate and review a baseline Prisma migration against the schema (including User↔Session and User/Task↔TaskActivity relations), then apply it to the disposable local database. Do not db-push a production/existing database.
4. Set DATABASE_URL for local PostgreSQL. Run reference seed. Run npm run test:integration; inspect every result, fix schema/API defects, and verify sessions survive API restart, role changes revoke sessions, and cross-department records stay inaccessible.
5. Add real-backend browser tests without route interception. Then finish normalized models, admin permission matrix and remaining task modal/calendar/timeline functionality before dependent business modules.
6. Continue milestones 7–17 in the map; all their routes currently show explicit unavailable states, not fake data. Full specification is preserved in docs/MASTER_SPECIFICATION.md.
7. SMTP delivery needs securely configured host/port/auth/from and PUBLIC_APP_URL; check existing variable presence before requesting credentials. No credential values in chat, code, docs or logs.

### Reproduction commands verified independently of DB
- Root: npm run build
- Direct units: node server/test/unit/security.test.js; node server/test/unit/taskWorkflow.test.js
- Browser: npm run dev -- --port 8001, then npm run test:ui (system Chromium path in playwright.config.js).

Do not run historical scripts/start_dev.sh: it has macOS paths. Current frontend dev server is Vite on standard port 8000. The task-owned Python static server and temporary port-8001 QA server were stopped after browser validation. Stop only task-owned processes before switching ports. Production deployment is not implemented.

Project creation/update/membership screens and endpoints are still outstanding; only the project listing endpoint is implemented. Do not consider the project-board module complete.

## Vercel deployment follow-up

User reported FUNCTION_INVOCATION_FAILED after deploying to Vercel. Exact hosted exception is unknown without Runtime Logs. Added root vercel.json (Vite frontend, same-origin Express function, static/SPA routing), api/index.js adapter, explicit Prisma generation in build:vercel, generated-engine inclusion, and rhel-openssl-3.0.x target for the Vercel Linux runtime. Trust the Vercel proxy for rate limiting only under VERCEL. Playwright now matches only *.spec.js, keeping Node deployment tests separate.

Four local deployment-configuration tests pass; React production build passes. Full Vercel build remains blocked in this cloud by binaries.prisma.sh policy (verified checksum fetch returns 403). This does not prove the same policy issue exists inside Vercel. No live deployment validation or Runtime Logs access is available. User must use repository root (not server/), hosted PostgreSQL, reviewed/applied schema, exact HTTPS APP_ORIGINS and redeploy. See docs/VERCEL_DEPLOYMENT.md. Changes do not complete the pending ERP modules or migration milestone.


## First-login provisioning follow-up

Vercel build now runs provision-admin --if-needed after Prisma generation/frontend build. INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD opt into first-account creation using the hosted DATABASE_URL. Without variables the build skips provisioning; existing admins are never overwritten. Provisioning uses transaction-level advisory locking and stores a bcrypt hash, without printing credentials. Four service tests passed (fake transaction adapter), optional-script skip verified, four deployment-config tests passed, frontend build passed. Actual hosted account creation is blocked: this task has no hosted DATABASE_URL, Vercel management connection, or provisioning values. The cloud Prisma download policy is still blocked. Hosted schema initialization remains a prerequisite. No usable email/password or account-creation success is claimed.


## UI-preview validation and release checkpoint

- npm run build:preview: passed without database or Prisma installation/generation.
- Built preview served locally; 2 Chromium end-to-end tests passed without API mocks. Verified wrong-password error, public preview login, protected-route redirect, stage review/approval, edit persistence across refresh, reset samples, logout, all seven viewport widths, mobile overlay close, and zero /api requests.
- npm run build (real API mode): passed; compiled JavaScript scanned to verify it contains neither public preview email nor preview password.
- 3 deployment configuration tests passed, including static-only default deployment and isolation from backend authentication.
- Main app modules beyond current dashboard/board/profile shell remain incomplete. Preview does not finish the original full ERP specification.
- Vercel must redeploy the new commit with root vercel.json settings. Default build now build:preview, not the old build:vercel override. Actual hosted redeployment has not been observed.


## UI login build-mode correction

User screenshot showed the real API login footer and no UI PREVIEW label, with a server/origin error. This indicates that a non-preview/stale build was being served, although hosted logs/settings are unavailable. Normal npm run build and npm run dev now explicitly enable UI preview; raw Vite defaults to preview unless VITE_UI_PREVIEW=false. The database-backed path requires explicit build:production/dev:production, and the full-stack Vercel build now calls build:production. No backend CORS policy was broadened. Recheck the built default preview end-to-end and confirm real production bundles still exclude public preview credentials.

Default npm run build now verified by the same 2 Chromium preview tests: both passed, including zero backend requests. Explicit npm run build:production also passed and its JavaScript excludes both public preview credentials; rebuilt the default preview afterward. Four deployment-configuration tests passed. Hosted Vercel redeployment remains outside this session.
