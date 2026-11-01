import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url)),
);
function route(path, files = new Set()) {
  for (const rule of config.routes) {
    if (rule.handle === "filesystem") {
      if (files.has(path)) return path;
      continue;
    }
    if (new RegExp(`^(?:${rule.src})$`).test(path)) return rule.dest;
  }
}
test("API paths reach the function instead of the React HTML fallback", () => {
  for (const path of [
    "/api",
    "/api/health",
    "/api/auth/login",
    "/api/tasks/426/transition",
  ])
    assert.equal(route(path), "/api/index.js");
});
test("React deep links fall back to index while built assets stay static", () => {
  for (const path of ["/", "/login", "/projects/project-1/board"])
    assert.equal(route(path), "/index.html");
  assert.equal(
    route("/assets/app.js", new Set(["/assets/app.js"])),
    "/assets/app.js",
  );
});
test("Vercel build generates the server Prisma client and includes its engines", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url)),
  );
  assert.match(
    pkg.scripts["build:vercel"],
    /prisma:generate --prefix server.*npm run build/,
  );
  assert.match(config.installCommand, /npm ci --include=dev --prefix server/);
  assert.equal(config.outputDirectory, "dist");
  assert.equal(
    config.functions["api/index.js"].includeFiles,
    "server/node_modules/.prisma/client/**",
  );
});

test("Prisma includes the Vercel Linux/OpenSSL runtime target", () => {
  const schema = readFileSync(
    new URL("../server/prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  assert.match(
    schema,
    /binaryTargets\s*=\s*\["native", "rhel-openssl-3\.0\.x"\]/,
  );
});
