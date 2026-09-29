// scripts/screenshots.mjs — docs/screenshots/raw/**/*.png → docs/screenshots/<name>.png at exactly 1179×2556
// (iPhone 16 Pro portrait). Run: npm run screenshots
// Matches .png/.jpg/.jpeg in any case, looks in subfolders, and strips doubled extensions
// ("home.png.png" → home.png). sharp reads the real format from the file contents, so a JPEG saved
// with a .png name still works; the output is always a real PNG.
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const RAW = join("docs", "screenshots", "raw");
const OUT = join("docs", "screenshots");
const IMAGE = /\.(png|jpe?g)$/i;

mkdirSync(RAW, { recursive: true });
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : IMAGE.test(e.name) ? [{ dir, name: e.name }] : []
  );

const files = walk(RAW);
if (!files.length) console.log(`No .png/.jpg files in ${RAW} (or its subfolders) — put the raw screenshots there first.`);

const seen = new Set();
for (const { dir, name } of files) {
  let base = name;
  while (IMAGE.test(base)) base = base.replace(IMAGE, ""); // strip every trailing image extension
  const out = join(OUT, `${base.toLowerCase()}.png`);
  if (seen.has(out)) { console.log(`Skipping ${join(dir, name)}: another file already produced ${out}`); continue; }
  seen.add(out);
  const { width, height } = await sharp(join(dir, name)).metadata();
  await sharp(join(dir, name)).resize(1179, 2556, { fit: "fill" }).png().toFile(out);
  console.log(`${join(dir, name)} (${width}×${height}) → ${out}`);
}
