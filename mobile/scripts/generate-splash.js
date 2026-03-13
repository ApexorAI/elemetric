/**
 * Generates the Elemetric splash screen PNG at 1284×2778 (iPhone 14 Pro Max native).
 * Run:  node scripts/generate-splash.js
 * Requires: canvas (already in devDependencies)
 */

const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const W = 1284;
const H = 2778;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// ── Background ────────────────────────────────────────────────────────────────
ctx.fillStyle = "#07152b";
ctx.fillRect(0, 0, W, H);

// ── Lightning bolt (orange, centred, above wordmark) ─────────────────────────
// Bolt path: simple 7-point polygon
const boltCX = W / 2;
const boltCY = H / 2 - 180;
const boltW = 130;
const boltH = 220;

ctx.fillStyle = "#f97316";
ctx.beginPath();
// Top-right → mid-left → mid-right → bottom-left
ctx.moveTo(boltCX + boltW * 0.18, boltCY - boltH * 0.5);   // top right
ctx.lineTo(boltCX - boltW * 0.5,  boltCY + boltH * 0.04);  // mid left
ctx.lineTo(boltCX - boltW * 0.08, boltCY + boltH * 0.04);  // mid centre-left
ctx.lineTo(boltCX - boltW * 0.18, boltCY + boltH * 0.5);   // bottom left
ctx.lineTo(boltCX + boltW * 0.5,  boltCY - boltH * 0.04);  // mid right
ctx.lineTo(boltCX + boltW * 0.08, boltCY - boltH * 0.04);  // mid centre-right
ctx.closePath();
ctx.fill();

// ── ELEMETRIC wordmark ────────────────────────────────────────────────────────
ctx.fillStyle = "#ffffff";
ctx.font = "900 148px Arial";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("ELEMETRIC", W / 2, H / 2 + 100);

// ── Tagline ───────────────────────────────────────────────────────────────────
ctx.fillStyle = "rgba(255,255,255,0.45)";
ctx.font = "400 52px Arial";
ctx.fillText("Compliance. Simplified.", W / 2, H / 2 + 220);

// ── Write PNG ─────────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, "..", "assets", "images", "splash-icon.png");
const buffer = canvas.toBuffer("image/png");
fs.writeFileSync(outPath, buffer);
console.log(`Splash written to ${outPath} (${W}×${H})`);
