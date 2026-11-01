import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const root = new URL("../", import.meta.url);
const active = JSON.parse(readFileSync(new URL("vercel.json", root)));
const production = JSON.parse(
  readFileSync(new URL("deployment/vercel.production.json", root)),
);
const pkg = JSON.parse(readFileSync(new URL("package.json", root)));
test("default Vercel deployment builds only the database-free UI preview", () => {
  assert.equal(active.buildCommand, "npm run build:preview");
  assert.equal(active.installCommand, "npm ci --include=dev");
  assert.equal(active.functions, undefined);
  assert.equal(existsSync(new URL("api/index.js", root)), false);
  assert.match(pkg.scripts["build:preview"], /VITE_UI_PREVIEW=true vite build/);
  assert.equal(active.routes.at(-1).dest, "/index.html");
});
test("real production configuration retains API routing and Prisma generation", () => {
  assert.equal(production.routes[0].dest, "/api/index.js");
  assert.equal(production.buildCommand, "npm run build:vercel");
  assert.match(
    pkg.scripts["build:vercel"],
    /prisma:generate --prefix server.*npm run build/,
  );
  assert.ok(existsSync(new URL("deployment/production-api.js", root)));
  assert.equal(
    production.functions["api/index.js"].includeFiles,
    "server/node_modules/.prisma/client/**",
  );
});
test("real backend never imports the frontend preview login", () => {
  for (const file of [
    "server/src/routes/auth.js",
    "server/src/middleware/auth.js",
  ])
    assert.doesNotMatch(
      readFileSync(new URL(file, root), "utf8"),
      /NexusUI@2026!|admin@mtnexus\.test|previewApi/,
    );
});
