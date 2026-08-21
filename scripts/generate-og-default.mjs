/**
 * Obsolete generator. Production Open Graph art is:
 *   public/og/ask-trust-hub-social-card.png (1200×630)
 * Do not point metadata at public/og-default.png.
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const w = 1200;
const h = 630;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A2540"/>
      <stop offset="48%" stop-color="#1E3A8A"/>
      <stop offset="100%" stop-color="#4F46E5"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="64" y="90" fill="#C7D2FE" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" letter-spacing="3">ASK TRUST HUB</text>
  <text x="64" y="280" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="700">Independent consumer research</text>
  <text x="64" y="340" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="700">for moving, insurance &amp; lending</text>
  <text x="64" y="420" fill="#E0E7FF" font-family="Segoe UI, Arial, sans-serif" font-size="24">We cite. You decide. · Common ownership · No paid placements</text>
  <text x="64" y="560" fill="#C7D2FE" font-family="Segoe UI, Arial, sans-serif" font-size="20">Move · Insurance · Lender Trust Hub</text>
  <text x="1136" y="560" fill="#C7D2FE" font-family="Segoe UI, Arial, sans-serif" font-size="20" text-anchor="end">asktrusthub.com</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(join(root, 'public', 'og-default.png'));
console.log('wrote public/og-default.png');
