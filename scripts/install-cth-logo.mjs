/**
 * Install ConsumerTrustHub logo → public brand assets + favicon set.
 * Usage: node scripts/install-cth-logo.mjs [sourcePath]
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = join(
  process.env.USERPROFILE || '',
  'Consumer Trust Hub',
  'logos for all verticals',
  'ConsumerTrustHub-logo-transparent.png'
);
const SOURCE = process.argv[2] || DEFAULT_SOURCE;
const OUT_DOCS = join(ROOT, 'docs', 'logo-update-2026-07');
const BRAND_DIR = join(ROOT, 'public', 'brand');

function isNearWhite(r, g, b, a) {
  if (a === 0) return false;
  if (r >= 235 && g >= 235 && b >= 235) return true;
  if (a < 24 && r >= 200 && g >= 200 && b >= 200) return true;
  return false;
}

async function cleanTransparent(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (isNearWhite(r, g, b, a)) {
      pixels[i] = pixels[i + 1] = pixels[i + 2] = pixels[i + 3] = 0;
      continue;
    }
    if (a === 0) {
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
    }
  }
  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

/** Dark-bg variant: lift dark navy wordmark to light tones; keep blue accents. */
async function toLightOnDark(cleanedPng) {
  const { data, info } = await sharp(cleanedPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a < 8) continue;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const isBlueAccent = b > r + 20 && b > g + 10 && b > 100;
    if (isBlueAccent) {
      // Brighten blue mark for navy footer
      pixels[i] = Math.min(255, Math.round(r * 1.15 + 20));
      pixels[i + 1] = Math.min(255, Math.round(g * 1.2 + 30));
      pixels[i + 2] = Math.min(255, Math.round(b * 1.05 + 15));
    } else if (lum < 140) {
      // Map dark text → near white
      const t = 1 - lum / 140;
      const w = Math.round(220 + t * 35);
      pixels[i] = w;
      pixels[i + 1] = w;
      pixels[i + 2] = Math.min(255, w + 8);
    }
  }
  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error('Source logo not found:', SOURCE);
    process.exit(1);
  }

  mkdirSync(BRAND_DIR, { recursive: true });
  mkdirSync(OUT_DOCS, { recursive: true });
  mkdirSync(join(ROOT, 'public'), { recursive: true });

  const prev = join(BRAND_DIR, 'logo.png');
  if (existsSync(prev)) copyFileSync(prev, join(OUT_DOCS, 'before-logo.png'));
  else if (existsSync(join(BRAND_DIR, 'logo.svg'))) {
    copyFileSync(join(BRAND_DIR, 'logo.svg'), join(OUT_DOCS, 'before-logo.svg'));
  }

  copyFileSync(SOURCE, join(BRAND_DIR, 'ConsumerTrustHub-logo-source.png'));

  const cleaned = await cleanTransparent(SOURCE);
  const meta = await sharp(cleaned).metadata();
  console.log(`Cleaned logo: ${meta.width}x${meta.height}`);

  await sharp(cleaned).toFile(join(BRAND_DIR, 'logo.png'));
  await sharp(cleaned).toFile(join(BRAND_DIR, 'logo-transparent.png'));
  await sharp(cleaned)
    .resize({ width: 1200, withoutEnlargement: true, fit: 'inside' })
    .png()
    .toFile(join(BRAND_DIR, 'consumertrusthub-logo.png'));

  const light = await toLightOnDark(cleaned);
  await sharp(light).toFile(join(BRAND_DIR, 'logo-light.png'));

  // Icon mark from right side (A)
  const iconX = Math.floor(meta.width * 0.58);
  const mark = await sharp(cleaned)
    .extract({ left: iconX, top: 0, width: meta.width - iconX, height: meta.height })
    .trim()
    .toBuffer();
  const markMeta = await sharp(mark).metadata();
  const side = Math.max(markMeta.width, markMeta.height);
  const padded = await sharp(mark)
    .extend({
      top: Math.floor((side - markMeta.height) / 2),
      bottom: Math.ceil((side - markMeta.height) / 2),
      left: Math.floor((side - markMeta.width) / 2),
      right: Math.ceil((side - markMeta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const sizes = [
    ['public/favicon-16.png', 16],
    ['public/favicon-32.png', 32],
    ['public/favicon-48.png', 48],
    ['public/favicon.png', 32],
    ['public/apple-touch-icon.png', 180],
    ['public/icon-192.png', 192],
    ['public/icon-512.png', 512],
  ];
  for (const [rel, size] of sizes) {
    await sharp(padded)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(join(ROOT, rel));
    console.log('Wrote', rel);
  }

  // Apple touch on white pad for iOS
  await sharp({
    create: { width: 180, height: 180, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      {
        input: await sharp(padded)
          .resize(150, 150, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer(),
        gravity: 'centre',
      },
    ])
    .png()
    .toFile(join(ROOT, 'public', 'apple-touch-icon.png'));

  await sharp(cleaned).toFile(join(OUT_DOCS, 'after-logo.png'));
  await sharp(padded).resize(256, 256).png().toFile(join(OUT_DOCS, 'after-icon.png'));

  async function headerMock(file, width, logoW) {
    const logoH = Math.round(logoW * (meta.height / meta.width));
    const logoBuf = await sharp(cleaned).resize(logoW, logoH, { fit: 'inside' }).png().toBuffer();
    const barH = Math.max(72, logoH + 28);
    const line = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${barH}">` +
        `<rect width="100%" height="100%" fill="#ffffff"/>` +
        `<line x1="0" y1="${barH - 1}" x2="${width}" y2="${barH - 1}" stroke="#e2e8f0" stroke-width="1"/>` +
        `</svg>`
    );
    await sharp(line)
      .composite([{ input: logoBuf, top: Math.floor((barH - logoH) / 2), left: 24 }])
      .png()
      .toFile(file);
  }

  await headerMock(join(OUT_DOCS, 'header-desktop.png'), 1200, 260);
  await headerMock(join(OUT_DOCS, 'header-mobile.png'), 390, 180);

  const footerLogo = await sharp(light).resize(220).png().toBuffer();
  const fl = await sharp(footerLogo).metadata();
  const footerBg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="120">` +
      `<rect width="100%" height="100%" fill="#0A2540"/>` +
      `</svg>`
  );
  await sharp(footerBg)
    .composite([{ input: footerLogo, top: Math.floor((120 - fl.height) / 2), left: 40 }])
    .png()
    .toFile(join(OUT_DOCS, 'footer-dark.png'));

  writeFileSync(
    join(OUT_DOCS, 'meta.json'),
    JSON.stringify(
      {
        width: meta.width,
        height: meta.height,
        aspect: meta.width / meta.height,
        source: SOURCE,
        version: '20260727',
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log('Done. Aspect', (meta.width / meta.height).toFixed(3));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
