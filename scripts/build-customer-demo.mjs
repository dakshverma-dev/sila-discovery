import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const demo = resolve(root, "customer-demo");
const savedLink = resolve(demo, ".vercel/project.json");
const outputLink = resolve(demo, "out/.vercel/project.json");
if (existsSync(outputLink)) {
  mkdirSync(resolve(demo, ".vercel"), { recursive: true });
  copyFileSync(outputLink, savedLink);
}
mkdirSync(resolve(demo, "public/art"), { recursive: true });
for (const name of ["printer", "caslon", "rhino", "hare", "orchidae", "bewick", "melencolia", "knight", "kelmscott", "strawberry", "actiniae", "trochilidae"]) {
  copyFileSync(resolve(root, `public/art/${name}.jpg`), resolve(demo, `public/art/${name}.jpg`));
}
// Do not load .env.local or copy the booking application's Vercel link. Only
// the product UI's imported modules and credited artwork enter this static export.
execFileSync(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "build", demo, "--webpack"], { cwd: root, stdio: "inherit" });
const output = resolve(demo, "out");
if (existsSync(savedLink)) {
  mkdirSync(resolve(output, ".vercel"), { recursive: true });
  copyFileSync(savedLink, resolve(output, ".vercel/project.json"));
}
const forbidden = ["sila_api", "scb_app_login", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "DEMO_CAPABILITY_SECRET"];
function scan(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(html|js|json|txt)$/.test(entry.name)) {
      const content = readFileSync(file, "utf8");
      if (forbidden.some((needle) => content.includes(needle))) throw new Error(`Server marker in customer demo: ${file}`);
    }
  }
}
scan(output);
writeFileSync(resolve(output, "vercel.json"), JSON.stringify({ cleanUrls: true,
  rewrites: [{source:"/plans/:id",destination:"/plans/record"},{source:"/venue/sessions/:id",destination:"/venue/sessions/record"},{source:"/s/:id",destination:"/s/record"},{source:"/s/:id/clubs",destination:"/s/record/clubs"},{source:"/s/:id/request",destination:"/s/record/request"}],
  headers: [{ source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }] }, null, 2));
console.log("Sila product UI exported and scanned: customer-demo/out (isolated sample records).");
