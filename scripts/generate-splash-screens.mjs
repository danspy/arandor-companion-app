#!/usr/bin/env node
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = join(__dirname, '..', 'public');
const splashDir = join(publicDir, 'splash');
const iconsDir = join(publicDir, 'icons');

// Read icon SVG
const iconSvg = readFileSync(join(iconsDir, 'icon.svg'));

// iOS splash screen sizes (device resolution)
// Format: [width, height, device name]
const iosSplashSizes = [
  [640, 1136, 'iphone5'],          // iPhone 5/SE
  [750, 1334, 'iphone6'],          // iPhone 6/7/8
  [1242, 2208, 'iphone6plus'],     // iPhone 6+/7+/8+
  [1125, 2436, 'iphonex'],         // iPhone X/XS/11 Pro
  [1242, 2688, 'iphonexsmax'],     // iPhone XS Max/11 Pro Max
  [828, 1792, 'iphonexr'],         // iPhone XR/11
  [1170, 2532, 'iphone12'],        // iPhone 12/12 Pro
  [1284, 2778, 'iphone12promax'],  // iPhone 12 Pro Max
  [1536, 2048, 'ipadmini'],        // iPad Mini
  [1668, 2224, 'ipadair'],         // iPad Air
  [1668, 2388, 'ipadpro10'],       // iPad Pro 10.5"
  [2048, 2732, 'ipadpro12'],       // iPad Pro 12.9"
];

console.log('Generating splash screens...\n');

// Theme colors
const lightBg = '#ffffff';
const darkBg = '#000000';
const primaryColor = '#8b4545';

// Helper function to create splash screen
async function createSplashScreen(width, height, deviceName, isDark = false) {
  const bgColor = isDark ? darkBg : lightBg;
  const suffix = isDark ? '-dark' : '';
  const outputPath = join(splashDir, `apple-splash-${deviceName}${suffix}.png`);
  
  // Calculate icon size (20% of screen width, max 200px)
  const iconSize = Math.min(Math.floor(width * 0.2), 200);
  
  // Create background
  const background = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bgColor
    }
  }).png();
  
  // Resize icon
  const icon = await sharp(iconSvg)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();
  
  // Calculate position to center the icon
  const left = Math.floor((width - iconSize) / 2);
  const top = Math.floor((height - iconSize) / 2);
  
  // Composite icon on background
  await background
    .composite([{
      input: icon,
      top: top,
      left: left
    }])
    .toFile(outputPath);
  
  console.log(`✓ Generated apple-splash-${deviceName}${suffix}.png (${width}x${height})`);
}

// Generate splash screens for both light and dark mode
for (const [width, height, deviceName] of iosSplashSizes) {
  await createSplashScreen(width, height, deviceName, false); // Light mode
  await createSplashScreen(width, height, deviceName, true);  // Dark mode
}

console.log('\n✅ All splash screens generated successfully!');
console.log(`\nGenerated ${iosSplashSizes.length * 2} splash screens (light and dark mode)`);
