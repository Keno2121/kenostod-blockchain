const sharp = require('sharp');
const path = require('path');

const INPUT = path.join(__dirname, '../attached_assets/keno_token_full_circle_visible_1779223711740.png');
const OUTPUT = path.join(__dirname, '../public/assets/keno-logo-enhanced.png');

async function enhanceLogo() {
  const image = sharp(INPUT);
  const meta = await image.metadata();
  const { width, height } = meta;

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  const channels = info.channels; // 4 (RGBA)

  for (let i = 0; i < pixels.length; i += channels) {
    let r = pixels[i];
    let g = pixels[i + 1];
    let b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a < 10) continue;

    // --- VIVID CONTRAST BOOST (S-curve) ---
    r = sCurve(r);
    g = sCurve(g);
    b = sCurve(b);

    // --- SATURATION BOOST ---
    const [h, s, l] = rgbToHsl(r, g, b);
    let newS = Math.min(1, s * 1.45);  // 45% more saturated
    let newL = l;

    // --- GOLD GLIMMER ---
    // Gold hue range: 25–50 degrees
    const isGold = h >= 25 && h <= 55 && s > 0.3 && l > 0.25;
    if (isGold) {
      newS = Math.min(1, s * 1.6);       // extra saturation on gold
      // Glimmer: boost lighter gold pixels even more (simulate shine)
      if (l > 0.55) {
        newL = Math.min(0.97, l * 1.22); // bright highlights pop
      } else if (l > 0.4) {
        newL = Math.min(0.85, l * 1.12);
      }
    }

    // --- EMERALD GREEN BOOST ---
    // Teal/emerald hue: 140–185 degrees
    const isEmerald = h >= 140 && h <= 185 && s > 0.25;
    if (isEmerald) {
      newS = Math.min(1, s * 1.35);
      newL = Math.min(0.75, l * 1.08);
    }

    const [nr, ng, nb] = hslToRgb(h, newS, newL);
    pixels[i]     = clamp(nr);
    pixels[i + 1] = clamp(ng);
    pixels[i + 2] = clamp(nb);
  }

  // --- SECOND PASS: Overall contrast sharpen + final render ---
  await sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: info.channels }
  })
    .png()
    .modulate({ brightness: 1.04 })   // very slight overall brightness lift
    .sharpen({ sigma: 1.1, m1: 0.5, m2: 2.5 })  // crisp edges
    .toFile(OUTPUT);

  console.log(`Enhanced logo saved to: ${OUTPUT}`);
  console.log(`Dimensions: ${info.width}x${info.height}`);
}

// --- S-CURVE for contrast (pulls shadows darker, highlights brighter) ---
function sCurve(v) {
  const n = v / 255;
  // Mild S-curve
  const out = n < 0.5
    ? 2 * n * n
    : -1 + (4 - 2 * n) * n;
  // Blend 60% s-curve with 40% original
  return Math.round((out * 0.55 + n * 0.45) * 255);
}

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
  h /= 360;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r * 255, g * 255, b * 255];
}

enhanceLogo().catch(console.error);
