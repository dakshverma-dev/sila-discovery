// Initialise a NEW dedicated hosted discovery database; never run on a pilot database.
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import dns from "node:dns";

// Optional per-process fallback for local routers that cache new Neon DNS badly.
// Keeps the original hostname for TLS validation; changes no computer settings.
if (process.argv.includes("--public-dns")) {
  const resolver = new dns.Resolver();
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  const original = dns.lookup;
  dns.lookup = (hostname, options, callback) => {
    if (typeof options === "function") { callback = options; options = {}; }
    if (!hostname.endsWith(".neon.tech")) return original(hostname, options, callback);
    resolver.resolve4(hostname, (error, addresses) => {
      if (error) return callback(error);
      if (options?.all) callback(null, addresses.map((address) => ({ address, family: 4 })));
      else callback(null, addresses[0], 4);
    });
  };
}

const root = resolve(import.meta.dirname, "..");
const source = parseEnv(readFileSync(resolve(root, ".env.host.local"), "utf8"));
const sourceUrl = source.DISCOVERY_ADMIN_DATABASE_URL_UNPOOLED || source.DISCOVERY_ADMIN_DATABASE_URL;
if (!sourceUrl) throw new Error("Pull the new project's admin configuration first.");
const adminUrl = new URL(sourceUrl);
adminUrl.searchParams.set("sslmode", "verify-full");
const privatePath = resolve(root, ".env.discovery.local");
if (existsSync(privatePath)) throw new Error("Hosted configuration already exists; refusing reinitialisation.");
const admin = new Pool({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 20000 });
try {
  const existing = await admin.query("select to_regnamespace('discovery') as schema");
  if (existing.rows[0].schema) throw new Error("Discovery schema already exists; refusing to change it.");
  const password = randomBytes(32).toString("hex");
  await admin.query(`create role sila_discovery login nosuperuser nocreatedb nocreaterole noinherit nobypassrls password '${password}'`);
  await admin.query(readFileSync(resolve(root, "discovery/schema.sql"), "utf8"));
  const { sessions } = await import("../lib/discovery/catalog.ts");
  for (const session of sessions) {
    await admin.query("insert into discovery.sessions(id,snapshot) values($1,$2)", [session.id, JSON.stringify(session)]);
  }
  const pooled = new URL(source.DISCOVERY_ADMIN_DATABASE_URL || adminUrl.toString());
  pooled.searchParams.set("sslmode", "verify-full");
  pooled.username = "sila_discovery";
  pooled.password = password;
  const appUrl = pooled.toString();
  const app = new Pool({ connectionString: appUrl, connectionTimeoutMillis: 20000 });
  try {
    const { rows } = await app.query("select count(*)::int as count from discovery.sessions");
    if (rows[0].count !== sessions.length) throw new Error("Catalogue verification failed.");
    const roles = await app.query("select rolsuper,rolbypassrls,rolcreaterole from pg_roles where rolname=current_user");
    if (Object.values(roles.rows[0]).some(Boolean)) throw new Error("Application role must remain unprivileged.");
    let denied = false;
    try { await app.query("update discovery.sessions set snapshot=snapshot"); } catch (error) { denied = error.code === "42501"; }
    if (!denied) throw new Error("Catalogue mutation was not denied.");
  } finally { await app.end(); }
  writeFileSync(privatePath, `DISCOVERY_DATABASE_URL=${appUrl}\nDISCOVERY_COOKIE_SECRET=${randomBytes(48).toString("hex")}\n`, { mode: 0o600 });
  console.log(`Initialised ${sessions.length} fictional sessions; limited role verified; credentials saved in ignored configuration.`);
} finally { await admin.end(); }
