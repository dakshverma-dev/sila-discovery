// Starts an isolated, persistent local discovery database; never connects to the pilot.
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import nextEnv from "@next/env";

const root = resolve(import.meta.dirname, "..");
nextEnv.loadEnvConfig(root);
const configPath = resolve(root, ".discovery-local.json");
const config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, "utf8"))
  : {
      admin: randomBytes(32).toString("hex"),
      app: randomBytes(32).toString("hex"),
      cookie: randomBytes(48).toString("hex"),
    };
if (!existsSync(configPath))
  writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
const docker = (args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const name = "sila-discovery-local";
const names = docker(["ps", "-a", "--format", "{{.Names}}"]).split(/\r?\n/);
if (!names.includes(name)) {
  docker([
    "run",
    "-d",
    "--name",
    name,
    "-p",
    "127.0.0.1:57432:5432",
    "-e",
    `POSTGRES_PASSWORD=${config.admin}`,
    "-e",
    "POSTGRES_DB=sila_discovery",
    "-v",
    "sila-discovery-local-data:/var/lib/postgresql/data",
    "postgres:16",
  ]);
} else docker(["start", name]);
const admin = new Pool({
  connectionString: `postgresql://postgres:${config.admin}@127.0.0.1:57432/sila_discovery`,
  connectionTimeoutMillis: 1500,
});
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    await admin.query("select 1");
    ready = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
if (!ready) {
  await admin.end();
  throw new Error("Local discovery database did not start");
}
try {
  const role = await admin.query(
    "select 1 from pg_roles where rolname='sila_discovery'",
  );
  // Generated hex only; SQL identifiers are fixed, no user input is interpolated.
  if (!role.rowCount)
    await admin.query(
      `create role sila_discovery login password '${config.app}'`,
    );
  await admin.query(
    readFileSync(resolve(root, "discovery/schema.sql"), "utf8"),
  );
  // Node 22.19+ supports stripping the catalogue's erasable TypeScript syntax.
  const { sessions } = await import("../lib/discovery/catalog.ts");
  for (const session of sessions)
    await admin.query(
      "insert into discovery.sessions(id,snapshot) values($1,$2) on conflict do nothing",
      [session.id, JSON.stringify(session)],
    );
} finally {
  await admin.end();
}
const discoveryUrl = `postgresql://sila_discovery:${config.app}@127.0.0.1:57432/sila_discovery`;
const environment = {
  ...process.env,
  DISCOVERY_DATABASE_URL: discoveryUrl,
  DISCOVERY_COOKIE_SECRET: config.cookie,
  DISCOVERY_LOCAL: "1",
};
if (process.argv.includes("--prepare")) {
  console.log(
    "Discovery database ready on loopback port 57432. Run npm run discovery to open the app.",
  );
  process.exit(0);
}
const port = process.env.DISCOVERY_PORT || "3500";
console.log(
  `Sila discovery: http://localhost:${port}/discover (fictional sessions; real Qloo)`,
);
const command = process.argv.includes("--production") ? "start" : "dev";
const app = spawn(
  process.execPath,
  [
    resolve(root, "node_modules/next/dist/bin/next"),
    command,
    "--port",
    port,
    "--hostname",
    "127.0.0.1",
  ],
  { cwd: root, stdio: "inherit", env: environment },
);
app.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => app.kill(signal));
