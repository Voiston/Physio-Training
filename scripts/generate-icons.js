import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const svgPath = path.join(publicDir, 'icon.svg');

if (!fs.existsSync(svgPath)) {
  console.error(`SVG source not found at ${svgPath}`);
  process.exit(1);
}

const svgBuffer = fs.readFileSync(svgPath);
const svgString = svgBuffer.toString('utf-8');

/**
 * Creates an ICO buffer from a single PNG buffer (standard modern ICO format containing PNG).
 * ICO header:
 * - 2 bytes: reserved (0)
 * - 2 bytes: type (1 for icon)
 * - 2 bytes: count (1)
 * Directory entry (16 bytes):
 * - 1 byte: width (32)
 * - 1 byte: height (32)
 * - 1 byte: colors (0)
 * - 1 byte: reserved (0)
 * - 2 bytes: planes (1)
 * - 2 bytes: bpp (32)
 * - 4 bytes: size in bytes
 * - 4 bytes: offset (22)
 * Followed by PNG payload.
 */
function createIcoFromPng(pngBuffer, width, height) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO type 1
  header.writeUInt16LE(1, 4); // 1 image

  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(width >= 256 ? 0 : width, 0);
  dirEntry.writeUInt8(height >= 256 ? 0 : height, 1);
  dirEntry.writeUInt8(0, 2); // Colors (0 = >= 8bpp)
  dirEntry.writeUInt8(0, 3); // Reserved
  dirEntry.writeUInt16LE(1, 4); // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel
  dirEntry.writeUInt32LE(pngBuffer.length, 8); // Size
  dirEntry.writeUInt32LE(22, 12); // Offset (6 + 16 = 22)

  return Buffer.concat([header, dirEntry, pngBuffer]);
}

async function generate() {
  console.log('Generating PWA icons from public/icon.svg...');

  // 1. Standard PWA 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✔ Generated public/pwa-192x192.png');

  // 2. Standard PWA 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✔ Generated public/pwa-512x512.png');

  // 3. Apple Touch Icon 180x180 (iOS Safari standard)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✔ Generated public/apple-touch-icon.png');

  // 4. Maskable 512x512 (with safe zone 80% circle - 10-15% margin on all sides)
  // Maskable icons require full bleed background without rounded corners,
  // and the logo content placed inside the safe zone (padding ~50px).
  const maskableInnerSize = 410; // ~80% of 512
  const innerPngBuffer = await sharp(svgBuffer)
    .resize(maskableInnerSize, maskableInnerSize, { fit: 'contain' })
    .png()
    .toBuffer();

  const maskableOffset = Math.round((512 - maskableInnerSize) / 2);

  // Full-bleed background for maskable
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 10, g: 10, b: 12, alpha: 1 }, // #0a0a0c brand dark bg
    },
  })
    .composite([
      {
        input: innerPngBuffer,
        top: maskableOffset,
        left: maskableOffset,
      },
    ])
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('✔ Generated public/pwa-maskable-512x512.png');

  // 5. Favicon 32x32 -> favicon.ico
  const fav32Png = await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toBuffer();

  const icoBuffer = createIcoFromPng(fav32Png, 32, 32);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('✔ Generated public/favicon.ico');

  console.log('All icons generated successfully!');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
