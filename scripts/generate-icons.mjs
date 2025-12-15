#!/usr/bin/env node
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');

// Read SVG files
const iconSvg = readFileSync(join(iconsDir, 'icon.svg'));
const maskableSvg = readFileSync(join(iconsDir, 'icon-maskable.svg'));

// Icon sizes to generate
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const appleSizes = [120, 152, 167, 180];

console.log('Generating PWA icons...\n');

// Generate standard icons
for (const size of sizes) {
  const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
  await sharp(iconSvg)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`✓ Generated icon-${size}x${size}.png`);
}

// Generate maskable icons
for (const size of [192, 512]) {
  const outputPath = join(iconsDir, `icon-maskable-${size}x${size}.png`);
  await sharp(maskableSvg)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`✓ Generated icon-maskable-${size}x${size}.png`);
}

// Generate Apple Touch Icons
for (const size of appleSizes) {
  const outputPath = join(iconsDir, `apple-touch-icon-${size}x${size}.png`);
  await sharp(iconSvg)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`✓ Generated apple-touch-icon-${size}x${size}.png`);
}

// Generate default apple-touch-icon
const defaultAppleIcon = join(publicDir, 'apple-touch-icon.png');
await sharp(iconSvg)
  .resize(180, 180)
  .png()
  .toFile(defaultAppleIcon);
console.log(`✓ Generated apple-touch-icon.png (180x180)`);

// Generate favicon.ico (32x32)
const faviconPath = join(publicDir, 'favicon.ico');
await sharp(iconSvg)
  .resize(32, 32)
  .png()
  .toFile(faviconPath);
console.log(`✓ Generated favicon.ico (32x32)`);

console.log('\n✅ All icons generated successfully!');
console.log('\nGenerated icons:');
console.log('  - PWA icons: 72x72 to 512x512');
console.log('  - Maskable icons: 192x192, 512x512');
console.log('  - Apple Touch Icons: 120x120 to 180x180');
console.log('  - Favicon: 32x32');
