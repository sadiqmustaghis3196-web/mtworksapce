import { copyFileSync, mkdirSync } from "node:fs";
const root = new URL("../", import.meta.url);
mkdirSync(new URL("api/", root), { recursive: true });
copyFileSync(
  new URL("deployment/production-api.js", root),
  new URL("api/index.js", root),
);
copyFileSync(
  new URL("deployment/vercel.production.json", root),
  new URL("vercel.json", root),
);
console.log(
  "Prepared full-stack deployment files. Configure hosted PostgreSQL, reviewed migrations and private credentials before deploying. UI preview credentials will not work in this build.",
);
