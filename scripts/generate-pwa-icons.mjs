#!/usr/bin/env node
// Generate ikon PWA (192/512 + maskable) dari logo.
// Jalankan: node scripts/generate-pwa-icons.mjs
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SRC = path.join(root, "public", "Baciraro cap.png");
const OUT = path.join(root, "public", "icons");
const APP_ICON = path.join(root, "src", "app", "icon.png");

if (!fs.existsSync(SRC)) {
  console.error("Sumber logo tidak ditemukan:", SRC);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const BG = { r: 17, g: 17, b: 17, alpha: 1 }; // #111111

async function makeSquare(size, logoRatio) {
  // logo muat di 68% sisi (aman untuk maskable safe-zone ~80%)
  const inner = Math.round(size * logoRatio);
  const logo = await sharp(SRC).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function main() {
  const icon192 = await makeSquare(192, 0.78);
  const icon512 = await makeSquare(512, 0.78);
  const maskable512 = await makeSquare(512, 0.6); // lebih banyak padding utk maskable

  fs.writeFileSync(path.join(OUT, "icon-192.png"), icon192);
  fs.writeFileSync(path.join(OUT, "icon-512.png"), icon512);
  fs.writeFileSync(path.join(OUT, "icon-512-maskable.png"), maskable512);
  fs.writeFileSync(APP_ICON, icon192); // favicon Next.js (app/icon.png)

  console.log("Ikon dibuat:");
  for (const f of ["icon-192.png", "icon-512.png", "icon-512-maskable.png"]) {
    const s = fs.statSync(path.join(OUT, f));
    console.log(`  public/icons/${f} (${s.size} bytes)`);
  }
  console.log("  src/app/icon.png (favicon)");
}

main().catch((e) => { console.error(e); process.exit(1); });
