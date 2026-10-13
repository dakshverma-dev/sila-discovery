// T21: fails if secrets or server-only markers appear in browser JavaScript.
// Run after `npm run build`. Reads secret values from the environment and .env.local.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = ".next/static";
if (!existsSync(root)) {
  console.error("No build output found. Run `npm run build` first.");
  process.exit(2);
}

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !(m[1] in env)) env[m[1]] = m[2];
  }
}

const secretNames = ["DATABASE_URL", "DEMO_CAPABILITY_SECRET", "QLOO_API_KEY", "WORKER_TRIGGER_SECRET", "CRON_SECRET",
                     "SUPABASE_SERVICE_ROLE_KEY", "LLM_API_KEY"];
const needles = [
  ...secretNames.filter((n) => (env[n] ?? "").length >= 8).map((n) => ({ label: `value of ${n}`, text: env[n] })),
  { label: "app database login", text: "scb_app_login" },
  { label: "Qloo host (server-only adapter)", text: "hackathon.api.qloo.com" },
  { label: "Qloo key header (server-only adapter)", text: "X-Api-Key" },
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|mjs|map|json|css|html)$/.test(name)) yield path;
  }
}

let scanned = 0;
const hits = [];
for (const file of files(root)) {
  const content = readFileSync(file, "utf8");
  scanned++;
  for (const n of needles) if (content.includes(n.text)) hits.push(`${n.label} in ${file}`);
}

if (hits.length) {
  console.error(`Client bundle check FAILED (${scanned} files):\n` + hits.map((h) => `  - ${h}`).join("\n"));
  process.exit(1);
}
console.log(`Client bundle check passed: ${scanned} files, ${needles.length} markers, no matches.`);
