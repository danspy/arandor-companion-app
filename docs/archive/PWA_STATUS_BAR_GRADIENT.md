# PWA Status Bar Gradient Overlay

## Overview

This feature adds a smooth gradient overlay at the top of the screen when the app is running as a Progressive Web App (PWA) in standalone mode. This is particularly useful for devices with status bars, notches, or dynamic islands (like iPhone's Dynamic Island).

## How It Works

### Detection
The gradient overlay is automatically shown only when the app is running as a PWA using the CSS media query:
```css
@media (display-mode: standalone)
```

This ensures the gradient is only visible when the app is installed and running as a standalone app, not when browsing in a regular browser.

### Visual Design
- **Light Mode**: A gradient from the primary theme color (burgundy/maroon `#8b4545`) that fades to transparent
- **Dark Mode**: A gradient from pure black that fades to transparent
- The gradient covers the safe-area-inset-top region (status bar area)
- The gradient has a smooth fade from 95% opacity to 70% at the midpoint, then to fully transparent

### Implementation Details

1. **CSS Class**: `.pwa-status-bar-gradient`
   - Fixed position at the top of the viewport
   - Height matches `var(--safe-top)` (safe-area-inset-top)
   - Z-index of 9999 to appear above content but not interfere with interactions
   - `pointer-events: none` to allow clicks through the gradient

2. **Color Matching**:
   - Light mode: Uses `rgba(139, 69, 69, ...)` matching the primary theme color
   - Dark mode: Uses `rgba(0, 0, 0, ...)` matching the dark mode navigation bar

3. **Smooth Transitions**:
   - Opacity transition of 0.3s for smooth appearance
   - Gradient transitions naturally from the navigation bar color to transparent

## Testing

### Testing as PWA on Mobile Devices

#### iOS (iPhone/iPad)
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Open the app from the home screen
5. The gradient should be visible at the top under the status bar/Dynamic Island

#### Android
1. Open the app in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home Screen" or "Install App"
4. Open the app from the home screen
5. The gradient should be visible at the top under the status bar

### Testing in Browser Dev Tools

To simulate PWA mode in Chrome DevTools:
1. Open DevTools (F12)
2. Open the DevTools menu (three dots) → More tools → Application
3. In the Application panel, find "Manifest" in the sidebar
4. You can also use the device toolbar to simulate mobile devices

Note: The `display-mode: standalone` media query will only trigger when the app is actually running as PWA, so the gradient won't show in regular browser mode.

## Browser Support

- **iOS Safari**: Full support (iOS 11.3+)
- **Android Chrome**: Full support (Chrome 45+)
- **Desktop PWA**: Supported in Chrome, Edge, and other Chromium-based browsers

## Customization

To adjust the gradient appearance, edit the following in `src/styles/global.css`:

```css
/* Adjust opacity values */
background: linear-gradient(
  to bottom, 
  rgba(139, 69, 69, 0.95),      /* Start opacity */
  rgba(139, 69, 69, 0.7) 50%,   /* Midpoint opacity */
  transparent                    /* End (fully transparent) */
);
```

## Accessibility

- The gradient overlay has `aria-hidden="true"` as it's purely decorative
- `pointer-events: none` ensures it doesn't interfere with touch interactions
- The gradient doesn't contain any interactive elements or important information
