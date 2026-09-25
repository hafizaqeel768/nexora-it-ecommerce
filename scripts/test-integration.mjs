// Integration tests against a throwaway database, never the dev data (run inside nexora_app):
//   docker compose exec app npm run test:integration
// Uses "<dev database>_test" on the same nexora_pg server: drops and recreates it, applies every migration
// (which also checks that they run cleanly from zero), then runs tests/integration/*.test.ts against it.
import { spawnSync } from "node:child_process";
import pg from "pg";

const devUrl = process.env.DATABASE_URL;
if (!devUrl) throw new Error("DATABASE_URL is not set (run this inside the nexora_app container).");
const url = new URL(devUrl);
const devName = url.pathname.slice(1);
const testName = `${devName}_test`;
if (!/^[a-z0-9_]+$/i.test(testName)) throw new Error(`Unexpected database name: ${testName}`);
const testUrl = new URL(devUrl);
testUrl.pathname = `/${testName}`;

const admin = new pg.Client({ connectionString: (() => { const u = new URL(devUrl); u.pathname = "/postgres"; return u.toString(); })() });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS "${testName}" WITH (FORCE)`);
await admin.query(`CREATE DATABASE "${testName}"`);
await admin.end();
console.log(`Created empty test database ${testName}.`);

const env = { ...process.env, DATABASE_URL: testUrl.toString(), NODE_ENV: "test" };
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["tsx", "--test", "--test-concurrency=1", ...process.argv.slice(2), "tests/integration/*.test.ts"]);
