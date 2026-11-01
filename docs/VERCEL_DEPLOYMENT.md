# Current deployment: UI preview

The user explicitly requested a temporary code-based test login and to finalize UI design before database work. The default root `vercel.json` now deploys only the static React UI preview. No backend function is deployed; no Prisma generation, database connection, admin provisioning, SMTP or private variables are required for this preview.

## Deploy now

- Root Directory: repository root (`./`), not `server/`.
- Framework: Vite. Use settings from `vercel.json`; remove any dashboard Build Command override that still runs the full-stack `build:vercel` command.
- Install: `npm ci --include=dev`.
- Build: `npm run build:preview`.
- Output: `dist`.
- Redeploy the latest main commit. Do not create a hosted database just to view this preview.

Public preview credentials (also displayed on the login form):

- Email: `admin@mtnexus.test`
- Password: `NexusUI@2026!`

These are public design-review credentials, not a real user account or a security boundary. No sensitive/company data belongs in this preview. The backend login never accepts these credentials unless a separate real account was explicitly created later.

Sample projects/tasks live in `src/preview/data.js`. Preview sessions use sessionStorage; sample edits/comments and stage transitions use a separate localStorage key. Refresh retains changes in that browser; Reset sample data restores the original samples. Other browsers/users do not share these changes. Password changes and email delivery are explicitly unavailable.

For local design work use `npm run dev:preview`. For the built-preview browser tests run `npm run build:preview`, serve with `npm run preview -- --port 8002`, then `npm run test:preview`. These tests run the actual preview implementation without API interception and assert that it makes no `/api/` requests.

## Restore the database-backed application later

Normal `npm run build` still compiles the real API-backed application without the preview login. To switch Vercel back to the full-stack deployment, run `npm run prepare:production`. This restores `api/index.js` and root `vercel.json` from `deployment/`, then review/commit those changes before deploying. The command never sets credentials or touches a database. Follow the requirements below for the database-backed phase.

---

# Full-stack deployment (later database phase)

Deploy this repository as **one Vercel project from its repository root**, not `server/`. `src/` builds the React app and `api/index.js` exports the existing Express API. Both run on the same hostname; `/api/*` reaches the Node function, other routes reach static files/the React router.

## Project settings

1. Root Directory: repository root (leave blank / choose `./`), **not** `server`.
2. Framework: Vite. Build/install/output settings come from root `vercel.json`; remove conflicting dashboard overrides.
3. Node.js: 22.x or 24.x (minimum 22.12).
4. Add environment variables securely in Vercel for each environment you deploy:
   - `DATABASE_URL`: real hosted PostgreSQL URL with TLS and a serverless-compatible connection pool. Vercel cannot reach this cloud's local Docker database or `127.0.0.1:5432`.
   - `NODE_ENV=production`.
   - `APP_ORIGINS`: exact comma-separated HTTPS frontend origins, no trailing slash. Include the actual deployed/custom hostname. Add only explicitly trusted preview origins when testing previews.
   - `PUBLIC_APP_URL`: actual HTTPS frontend URL, needed for reset links.
   - SMTP variables from `server/.env.example` only when configuring password-reset delivery. Do not expose these as `VITE_*` variables.
5. Redeploy the latest Git commit after changing Root Directory, environment variables, or build settings.

The build installs root and server lockfiles and explicitly runs `prisma generate` before the Vite build. A generation failure stops the build rather than publishing a function with an unusable Prisma client. The function bundles the generated Prisma engine. The schema includes rhel-openssl-3.0.x for Vercel Node 22/24 in addition to native local engines. Express trusts the Vercel proxy for the rate limiter only when VERCEL is set. Installation/build logs must show successful Prisma generation.

## Database prerequisite

The rebuild does not yet have a generated/reviewed baseline migration. This remains a release blocker. Complete the database milestone and apply reviewed migrations to the hosted database through a controlled operator step. Do not automatically push the schema or seed accounts during each Vercel build. No local Docker data is transferred by deployment.

After verified schema setup, seed reference roles/permissions and provision the initial administrator with the documented operator command against the intended hosted database, securely supplying the password. No default login exists. Do not expose provisioning as a public API.

### Create the first login during a Vercel build

Once the hosted database schema is ready, set INITIAL_ADMIN_EMAIL to your desired login email and INITIAL_ADMIN_PASSWORD to a strong private password (12–128 characters, uppercase/lowercase/number) in Vercel environment settings for the intended deployment. Redeploy. The build now runs the operator script with --if-needed after Prisma generation and the frontend build succeed. It skips provisioning when neither variable is configured; partial/invalid input fails the build. It creates a first Super Admin only when none exists. Repeated builds never reset passwords, promote existing accounts, or overwrite an existing admin. A PostgreSQL transaction/advisory lock serializes concurrent first-account creation.

After the build explicitly confirms creation, sign in using the same email/password you entered privately, then remove INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD from Vercel settings and change the temporary password in your profile. Missing tables or inaccessible PostgreSQL still block account creation; this step does not silently push the schema or create a database. No production account has been created or verified by this task.

## Verify the deployment

- `/login`: HTML page, not a function crash.
- Refresh `/projects`: React entry loads (then login if unauthenticated).
- `/api/auth/me`: 401 JSON when signed out. A 500 indicates a function/dependency/configuration failure; inspect Runtime Logs.
- `/api/health`: 200 healthy only after database connection and schema are actually ready; 503 is not success.
- With a provisioned account: login/logout, refresh, and task transition/history tests must pass against the real database before release readiness.

`FUNCTION_INVOCATION_FAILED` alone does not identify the cause. Runtime Logs provide the actual exception. Common errors include missing generated Prisma client/engine, missing DATABASE_URL, unreachable localhost database, or tables that have not been migrated. Do not share database URLs, passwords, cookies, or reset tokens in logs/chat.

## Validation limits in this cloud

The React build and local routing configuration tests can run. The current cloud policy still blocks binaries.prisma.sh, so the complete Vercel build/backend integration cannot be verified here yet. No Vercel logs or project settings are accessible through this session. A successful Git push does not prove Vercel deployed successfully.
