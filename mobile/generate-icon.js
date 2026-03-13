// Run with: node generate-icon.js
// Requires: npm install --save-dev canvas
const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const SIZE = 1024;
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext("2d");

// Background — dark navy
ctx.fillStyle = "#0A1628";
ctx.fillRect(0, 0, SIZE, SIZE);

// Subtle radial glow behind the bolt
const glow = ctx.createRadialGradient(512, 490, 0, 512, 490, 480);
glow.addColorStop(0, "rgba(255, 107, 0, 0.18)");
glow.addColorStop(1, "rgba(255, 107, 0, 0)");
ctx.fillStyle = glow;
ctx.fillRect(0, 0, SIZE, SIZE);

// Lightning bolt — orange (#FF6B00)
// Centered polygon in a 1024×1024 space
ctx.fillStyle = "#FF6B00";
ctx.beginPath();
ctx.moveTo(620, 110);   // top
ctx.lineTo(305, 545);   // mid-left
ctx.lineTo(500, 545);   // inner notch (upper)
ctx.lineTo(400, 920);   // bottom
ctx.lineTo(715, 490);   // mid-right
ctx.lineTo(520, 490);   // inner notch (lower)
ctx.closePath();
ctx.fill();

// Write PNG
const outDir = path.join(__dirname, "assets");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "app.png");
fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
console.log("Icon written to", outPath);
