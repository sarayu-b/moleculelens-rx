// scripts/render-icon.mjs — assets/icon.svg → app icon + README icon. Run: npm run icon
import { mkdirSync } from "node:fs";
import sharp from "sharp";

mkdirSync("docs", { recursive: true });
const svg = "assets/icon.svg";

// App icon: opaque, full-bleed (iOS rejects transparency and applies its own rounded mask).
await sharp(svg, { density: 300 }).resize(1024, 1024).flatten({ background: "#0b1020" }).png().toFile("assets/images/icon.png");
// README icon: keeps the transparent rounded corners.
await sharp(svg, { density: 300 }).resize(1024, 1024).png().toFile("docs/icon-1024.png");
console.log("Wrote assets/images/icon.png and docs/icon-1024.png (1024×1024)");
