#!/usr/bin/env node
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = join(__dirname, '..', 'public');
const screenshotsDir = join(publicDir, 'screenshots');

console.log('Generating placeholder screenshots...\n');

const primaryColor = '#8b4545';
const textColor = '#ffffff';

// Create wide screenshot (for desktop/tablet)
await sharp({
  create: {
    width: 1280,
    height: 720,
    channels: 4,
    background: primaryColor
  }
})
  .png()
  .toFile(join(screenshotsDir, 'screenshot-wide.png'));

console.log('✓ Generated screenshot-wide.png (1280x720)');

// Create mobile screenshot
await sharp({
  create: {
    width: 640,
    height: 1136,
    channels: 4,
    background: primaryColor
  }
})
  .png()
  .toFile(join(screenshotsDir, 'screenshot-mobile.png'));

console.log('✓ Generated screenshot-mobile.png (640x1136)');

console.log('\n✅ Placeholder screenshots generated!');
console.log('\n📝 Note: Replace these with actual app screenshots for better PWA experience.');
console.log('   Take screenshots of your app and replace:');
console.log('   - public/screenshots/screenshot-wide.png');
console.log('   - public/screenshots/screenshot-mobile.png');
