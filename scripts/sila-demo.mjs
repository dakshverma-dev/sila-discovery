// Local-only demo, guide §§19, 22, 27. Its own Docker project/database and email
// inbox keep synthetic fixtures separate from ordinary development and hosting.
import { randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const root = resolve(import.meta.dirname, "..");
const workdir = resolve(root, ".supabase/sila-demo");
const target = resolve(workdir, "supabase");
const cli = resolve(root, "node_modules/supabase/dist/supabase.js");
const next = resolve(root, "node_modules/next/dist/bin/next");
const local = (raw) => ["127.0.0.1", "localhost", "[::1]"].includes(new URL(raw).hostname);
mkdirSync(target, { recursive: true });
cpSync(resolve(root, "supabase/migrations"), resolve(target, "migrations"), { recursive: true });
cpSync(resolve(root, "supabase/seed.sql"), resolve(target, "seed.sql"));
const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8")
  .replace('project_id = "shared-cultural-bookings"', 'project_id = "sila-pilot-demo"')
  .replaceAll("5432", "5632")
  .replace("http://localhost:3100/**", "http://localhost:3300/**");
writeFileSync(resolve(target, "config.toml"), config);

function supabase(args) {
  // Never echo status/start stdout: it contains local keys. No shell expansion.
  return execFileSync(process.execPath, [cli, ...args, "--workdir", workdir], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024,
  });
}

console.log("Starting the separate synthetic Sila demo stack (Docker required)…");
supabase(["start"]);
supabase(["migration", "up", "--local"]);
const status = JSON.parse(supabase(["status", "--output", "json"]));
if (!local(status.DB_URL) || !local(status.API_URL)) throw new Error("Demo fixtures require loopback services");
const db = new Pool({ connectionString: status.DB_URL, max: 1 });
try {
  // Seed once; rerunning never resets existing agreements or receipts.
  const holidays = [...readFileSync(resolve(root, "lib/sila/calendar.ts"), "utf8")
    .matchAll(/"(\d{4}-\d{2}-\d{2})"/g)].map((match) => match[1]);
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(56321001)");
  await db.query(`insert into sila.operators(email) values ('ops@demo.sila.example') on conflict do nothing`);
  await db.query(`insert into sila.venues(id, name, address, access_facts, contact_email)
    values ('de000000-0000-4000-8000-000000000001', 'Demo Edinburgh Print Studio',
      'Fictional demo address, Edinburgh', 'Synthetic access facts: level entrance. Discuss individual arrangements directly with the venue.',
      'venue@demo.sila.example') on conflict do nothing`);
  await db.query(`insert into sila.operator_venue_scopes(email, venue_id, granted_reason)
    select 'ops@demo.sila.example', 'de000000-0000-4000-8000-000000000001', 'Synthetic local demo bootstrap'
    where not exists (select 1 from sila.operator_venue_scopes where email = 'ops@demo.sila.example'
      and venue_id = 'de000000-0000-4000-8000-000000000001' and revoked_at is null)`);
  for (const role of ["coordinator", "finance"]) {
    await db.query(`insert into sila.venue_members(venue_id,email,role)
      values ('de000000-0000-4000-8000-000000000001',$1,$2) on conflict do nothing`, [`${role}@demo.sila.example`, role]);
  }
  await db.query(`with business_dates as (
      select d::date as day from generate_series((now() at time zone 'Europe/London')::date,
        (now() at time zone 'Europe/London')::date + 40, '1 day') d
      where extract(isodow from d) < 6 and not d::date = any($1::date[])
    ), dates as (
      select (select min(day) from business_dates where day >= (now() at time zone 'Europe/London')::date + 14) as decision,
        (select min(day) from business_dates where day >= (now() at time zone 'Europe/London')::date + 2) as fill,
        array(select day from business_dates) as covered
    )
    insert into sila.sessions(id, venue_id, title, description, inclusions, meeting_point,
      starts_at, ends_at, price_minor, minimum, capacity, fill_by, decision_by, balance_due_at,
      resource_name, hold_expires_at, hold_checked_by, hold_checked_at, covered_dates,
      venue_terms_version, venue_terms_text, platform_terms_version, access_facts_reviewed,
      run_at_minimum_approved, payment_route)
    select 'de000000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000001',
      'Demo: an evening in the print room', 'Fictional printmaking workshop for the local Sila pilot demo. No real workshop is offered.',
      'Synthetic instruction and materials', 'Fictional studio front desk',
      (decision + 14 + time '18:00') at time zone 'Europe/London',
      (decision + 14 + time '20:00') at time zone 'Europe/London', 3500, 16, 20,
      (fill + time '12:00') at time zone 'Europe/London',
      (decision + time '12:00') at time zone 'Europe/London',
      ((select min(day) from business_dates where day > decision) + time '12:00') at time zone 'Europe/London',
      'Synthetic print room and instructor', (decision + time '12:00') at time zone 'Europe/London',
      'Demo coordinator; no real resource approval', now(), covered,
      'demo-venue-v1', 'SYNTHETIC TERMS: conditional places; no payment before staffed opening; free withdrawal before opening; full return of simulated payments if unconfirmed. Not approved for live use.',
      'demo-platform-v1', true, true, 'DEMO ONLY. Do not transfer money. Record simulated receipts only.'
    from dates on conflict (id) do nothing`, [holidays]);
  await db.query("commit");
} catch (error) {
  await db.query("rollback");
  throw error;
} finally { await db.end(); }

console.log("Demo prepared. Open http://localhost:3300/pilot-demo · local inbox http://127.0.0.1:56324");
if (process.argv.includes("--seed-only")) process.exit(0);
const app = spawn(process.execPath, [next, "dev", "--port", "3300"], {
  cwd: root, stdio: "inherit", env: {
    ...process.env, SILA_DEMO_MODE: "local", APP_BASE_URL: "http://localhost:3300",
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SILA_AUTH_URL: status.API_URL, SILA_AUTH_PUBLIC_KEY: status.ANON_KEY,
    DATABASE_URL: "postgresql://scb_app_login:scb_local_dev_only@127.0.0.1:56322/postgres",
    SILA_DRAFT_SECRET: randomBytes(48).toString("hex"),
  },
});
app.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => app.kill(signal));
