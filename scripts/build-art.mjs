// Resizes and recompresses the sila design plates (Design/assets/img) into public/art.
// Run with `node scripts/build-art.mjs` after adding or replacing a plate.
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const src = "Design/assets/img";
const out = "public/art";
// Plates shown full-bleed get more pixels; everything else is a matted plate or a tile.
const WIDE = new Set(["wave", "wayang", "kentedetail", "printer", "hamza", "mendoza", "actiniae"]);

mkdirSync(out, { recursive: true });
let before = 0;
let after = 0;
for (const name of readdirSync(src).filter((f) => f.endsWith(".jpg"))) {
  const key = name.replace(/\.jpg$/, "");
  const target = join(out, name);
  await sharp(join(src, name))
    .rotate()
    .resize({ width: WIDE.has(key) ? 1800 : 1000, height: WIDE.has(key) ? 1500 : 1200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 68, mozjpeg: true, progressive: true })
    .toFile(target);
  before += statSync(join(src, name)).size;
  after += statSync(target).size;
}
console.log(`plates: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
