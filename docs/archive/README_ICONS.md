# App Icons and Splash Screens Guide

This guide explains how to customize the app icons and splash screens for the Arandor Companion App PWA (Progressive Web App).

## 📱 Overview

The app is fully installable on both Android and iOS devices with custom icons and splash screens that support dark mode.

## 🎨 Where to Change Icons and Splash Screens

### Source Graphics Location

All icons and splash screens are generated from these source SVG files:

```
public/icons/icon.svg              ← Main app icon (change this!)
public/icons/icon-maskable.svg     ← Maskable icon for Android (change this!)
```

### How to Replace Graphics

**Option 1: Edit SVG Files (Recommended)**
1. Open `public/icons/icon.svg` in your favorite SVG editor (Inkscape, Figma, Adobe Illustrator, etc.)
2. Edit the design while keeping the 512x512 viewBox
3. For the maskable icon, edit `public/icons/icon-maskable.svg` and ensure important content stays within the safe area (center 80%)
4. Save your changes
5. Run the generation script to create all icon sizes:
   ```bash
   npm run generate-icons
   ```

**Option 2: Replace SVG Files**
1. Create your own 512x512 SVG icon
2. Save it as `public/icons/icon.svg`
3. Create a maskable version (full-bleed design) and save as `public/icons/icon-maskable.svg`
4. Run the generation script:
   ```bash
   npm run generate-icons
   npm run generate-splash
   ```

### SVG Design Guidelines

**Standard Icon (`icon.svg`):**
- Size: 512x512 viewBox
- Can have rounded corners (rx="64" for nice rounded square)
- Content should be clearly visible
- Good contrast for visibility

**Maskable Icon (`icon-maskable.svg`):**
- Size: 512x512 viewBox
- NO rounded corners (system applies mask)
- Full-bleed design (use entire canvas)
- Keep important content in center 80% (safe area)
- Background should extend to all edges

### Current Design

The default icon features:
- Gradient background from `#8b4545` (burgundy) to `#5f2f2f` (darker burgundy)
- White letter "A" (for Arandor)
- Rounded corners on standard icon
- Full-bleed on maskable icon

## 📂 Generated Files Structure

After running generation scripts, these files are created:

```
public/
├── favicon.ico                    # 32x32 favicon
├── apple-touch-icon.png           # 180x180 iOS default
├── manifest.webmanifest           # PWA manifest
│
├── icons/                         # All app icons
│   ├── icon.svg                   # Source icon
│   ├── icon-maskable.svg          # Source maskable icon
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png           # Android standard
│   ├── icon-384x384.png
│   ├── icon-512x512.png           # Android high-res
│   ├── icon-maskable-192x192.png  # Android maskable
│   ├── icon-maskable-512x512.png
│   ├── apple-touch-icon-120x120.png
│   ├── apple-touch-icon-152x152.png
│   ├── apple-touch-icon-167x167.png
│   └── apple-touch-icon-180x180.png
│
├── splash/                        # iOS splash screens
│   ├── apple-splash-iphone5.png           # Light mode
│   ├── apple-splash-iphone5-dark.png      # Dark mode
│   ├── apple-splash-iphone6.png
│   ├── apple-splash-iphone6-dark.png
│   ├── ... (24 total splash screens)
│   └── apple-splash-ipadpro12-dark.png
│
└── screenshots/                   # PWA screenshots
    ├── screenshot-wide.png        # 1280x720 (desktop)
    └── screenshot-mobile.png      # 640x1136 (mobile)
```

## 🛠️ Generation Scripts

### Generate All Icons

```bash
npm run generate-icons
```

This script:
- Reads `public/icons/icon.svg` and `icon-maskable.svg`
- Generates all required PNG icons in various sizes
- Creates Apple Touch Icons
- Generates favicon.ico

### Generate Splash Screens

```bash
npm run generate-splash
```

This script:
- Creates splash screens for all iOS device sizes
- Generates both light and dark mode versions
- Centers the app icon on appropriate background color

### Generate Screenshots (Optional)

```bash
npm run generate-screenshots
```

Creates placeholder screenshots. **Recommended:** Replace with actual app screenshots:
1. Open the app in a browser
2. Take screenshots of key pages
3. Resize to 1280x720 (wide) and 640x1136 (mobile)
4. Save as `public/screenshots/screenshot-wide.png` and `screenshot-mobile.png`

## 🎨 Customization Tips

### Color Scheme

Current colors (defined in SVG and scripts):
- Primary: `#8b4545` (burgundy)
- Primary Dark: `#5f2f2f` 
- Light Background: `#ffffff` (white)
- Dark Background: `#000000` (black)

To change colors:
1. Edit the SVG files directly
2. Or modify `scripts/generate-splash-screens.mjs` to change splash background colors

### Logo/Icon Design

For best results:
- Use simple, recognizable designs
- Ensure good contrast between icon and background
- Test on both light and dark backgrounds
- Keep text/symbols large and readable
- Avoid fine details that may blur when scaled down

### Maskable Icons (Android Adaptive Icons)

Android can apply various shapes (circle, square, rounded square) to your icon. The maskable icon ensures your design looks good in any shape:

```
┌────────────────┐
│ ░░░░░░░░░░░░░░ │  Full canvas = 100%
│ ░░┌────────┐░░ │  
│ ░░│        │░░ │  Safe area = center 80%
│ ░░│  LOGO  │░░ │  (Keep important content here)
│ ░░│        │░░ │
│ ░░└────────┘░░ │
│ ░░░░░░░░░░░░░░ │
└────────────────┘
```

## 📦 Adding Generation Scripts to package.json

Add these scripts to your `package.json` for easier access:

```json
{
  "scripts": {
    "generate-icons": "node scripts/generate-icons.mjs",
    "generate-splash": "node scripts/generate-splash-screens.mjs",
    "generate-screenshots": "node scripts/generate-screenshots.mjs",
    "generate-all-assets": "npm run generate-icons && npm run generate-splash && npm run generate-screenshots"
  }
}
```

## 🔧 Technical Details

### Icon Sizes Explained

- **72x72 to 512x512**: Standard PWA icons for various device densities
- **Maskable**: Android adaptive icons that can be cropped to any shape
- **Apple Touch Icons**: iOS home screen icons (120, 152, 167, 180)
- **Favicon**: 32x32 browser tab icon

### Splash Screen Sizes

iOS requires specific splash screen sizes for each device:
- iPhone 5/SE: 640×1136
- iPhone 6/7/8: 750×1334
- iPhone X/XS: 1125×2436
- iPhone 12 Pro Max: 1284×2778
- iPad Mini: 1536×2048
- iPad Pro 12.9": 2048×2732
- And more...

Each size has both light and dark mode versions!

### Dark Mode Support

The app automatically serves:
- Dark splash screens when device is in dark mode
- Dark theme color for status bar
- Appropriate icon contrast

## 🚀 Testing Your Changes

1. **Generate Assets:**
   ```bash
   npm run generate-icons
   npm run generate-splash
   ```

2. **Build the App:**
   ```bash
   npm run build
   ```

3. **Preview:**
   ```bash
   npm run preview
   ```

4. **Test Installation:**
   - Android Chrome: Look for "Install App" in menu
   - iOS Safari: Tap Share → "Add to Home Screen"
   - Desktop: Look for install icon in address bar

5. **Verify:**
   - Icon appears correctly on home screen
   - Splash screen shows when launching (iOS)
   - App runs in standalone mode (no browser UI)
   - Dark mode splash/icons work correctly

## ⚠️ Important Notes

- Always regenerate icons after editing SVG files
- Test on multiple devices and screen sizes
- Splash screens only show on iOS, not Android
- Android uses the manifest icons and theme colors
- Changes require rebuilding the app
- Clear browser cache if icons don't update

## 📚 Resources

- [PWA Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Maskable Icons](https://web.dev/maskable-icon/)
- [iOS Web App Meta Tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Android Adaptive Icons](https://developer.android.com/guide/practices/ui_guidelines/icon_design_adaptive)

## 🎯 Quick Start Checklist

- [ ] Edit `public/icons/icon.svg` with your design
- [ ] Edit `public/icons/icon-maskable.svg` (keep safe area in mind)
- [ ] Run `npm run generate-icons`
- [ ] Run `npm run generate-splash`
- [ ] (Optional) Replace screenshot placeholders with real screenshots
- [ ] Build and test on mobile device
- [ ] Verify icon and splash screen appearance
- [ ] Check both light and dark modes

---

**Need Help?** The generation scripts use [sharp](https://sharp.pixelplumbing.com/) for image processing. All source files are in `scripts/` directory.
