// scripts/screenshots.mjs — docs/screenshots/raw/*.png → docs/screenshots/<name>.png at exactly 1179×2556
// (iPhone 16 Pro portrait). Run: npm run screenshots
import { mkdirSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";

const RAW = join("docs", "screenshots", "raw");
const OUT = join("docs", "screenshots");
mkdirSync(RAW, { recursive: true });
const files = readdirSync(RAW).filter((f) => f.toLowerCase().endsWith(".png"));
if (!files.length) console.log(`No PNGs in ${RAW} — put the raw screenshots there first.`);
for (const f of files) {
  const out = join(OUT, `${basename(f, ".png").replace(/\.PNG$/i, "")}.png`);
  await sharp(join(RAW, f)).resize(1179, 2556, { fit: "fill" }).png().toFile(out);
  console.log(`${f} → ${out}`);
}
