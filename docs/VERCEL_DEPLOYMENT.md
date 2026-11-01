# Vercel deployment

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
