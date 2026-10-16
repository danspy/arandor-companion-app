# PWA Layout and Spacing

## Overview

This document describes how the PWA layout system works, including viewport height management, bottom spacing, and the floating menu button positioning.

## Viewport Height Management

### The Problem with 100vh on Mobile

Mobile browsers have dynamic UI elements (address bars, toolbars) that appear and disappear during scrolling:
- On iOS Safari, the address bar can be ~60-80px
- On Android Chrome, the bottom navigation can be ~40-60px
- Traditional `100vh` is calculated when browser UI is **hidden**
- This causes a mismatch between intended height and actual visible height

### The Solution: 100dvh (Dynamic Viewport Height)

We use `100dvh` which dynamically adjusts to the **actual visible viewport height**:

```css
html, body {
  overflow-x: clip;
  /* Use dvh for dynamic viewport height that accounts for mobile browser UI */
  min-height: 100vh; /* Fallback for older browsers */
  min-height: 100dvh; /* Modern browsers - dynamic viewport height */
  min-height: -webkit-fill-available; /* iOS Safari fallback */
}
```

### Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 108+ | `100dvh` |
| Safari | 15.4+ | `100dvh` |
| Firefox | 110+ | `100dvh` |
| Older browsers | Any | Falls back to `100vh` |

### Cascade Strategy

The CSS uses multiple declarations to ensure maximum compatibility:

1. `min-height: 100vh` - Base fallback for all browsers
2. `min-height: 100dvh` - Overrides in modern browsers that support it
3. `min-height: -webkit-fill-available` - Additional iOS Safari optimization

Modern browsers will use the last supported declaration, ensuring the best experience.

## PWA Mode Specific Layout

### Detection

PWA mode is detected using the CSS media query:
```css
@media (display-mode: standalone) and (max-width: 1024px)
```

This ensures PWA-specific styles only apply when:
- App is running as installed PWA (standalone mode)
- On mobile/tablet devices (max-width: 1024px)

### PWA Mode Changes

When in PWA mode, the layout adapts:

1. **Navigation and Footer Hidden**:
```css
.pwa-hide-nav {
  display: none !important;
}

.pwa-hide-footer {
  display: none !important;
}
```

2. **Full Viewport Height**:
```css
body {
  height: 100vh; /* Fallback for older browsers */
  height: 100dvh; /* Dynamic viewport height */
  height: -webkit-fill-available; /* iOS Safari fallback */
}
```

3. **Main Content Padding**:
```css
main {
  padding-top: var(--pwa-main-padding-top);
  padding-bottom: var(--pwa-floating-menu-clearance);
}
```

### CSS Custom Properties

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --pwa-main-padding-top: max(env(safe-area-inset-top), 1rem);
  --pwa-floating-menu-clearance: 96px;
}
```

- `--safe-top`: Accounts for notches and status bars
- `--pwa-main-padding-top`: Top padding for main content (status bar + min 1rem)
- `--pwa-floating-menu-clearance`: Bottom clearance (56px button + 16px spacing + 24px safety = 96px)

## Floating Menu Button Positioning

### Button Position

The floating menu button is positioned using:
```css
.pwa-menu-button {
  position: fixed;
  bottom: var(--pwa-menu-button-spacing); /* 16px */
  right: calc(var(--pwa-menu-button-spacing) + env(safe-area-inset-right));
  width: 56px;
  height: 56px;
}
```

### Why This Works

With `100dvh`:
1. Page fills actual visible viewport
2. `body` has `height: 100dvh`
3. Button positioned relative to viewport with `position: fixed`
4. `bottom: 16px` is 16px from actual visible bottom
5. Button always appears at correct screen bottom

Without `100dvh` (the old problem):
1. Page calculated as full height when UI hidden
2. Actual visible area smaller
3. Button positioned relative to wrong height
4. Button appears too high on screen

## Content Padding for Button Clearance

To prevent content from being hidden behind the button, main content has bottom padding:

```css
main {
  padding-bottom: var(--pwa-floating-menu-clearance); /* 96px */
}
```

This ensures:
- Content doesn't overlap with button
- Last item in list is always visible
- Scrolling works correctly
- Button doesn't block interactive elements

## Short Page Handling

### The Issue

Pages with minimal content (empty initiative tracker, map page) need special handling:
- Without proper height, page doesn't fill viewport
- Button positioning becomes unclear
- Empty space appears in wrong places

### The Fix

Using `100dvh` ensures:
1. Even short pages fill viewport
2. Body expands to visible screen height
3. Main content uses flexbox (`flex: 1 0 auto`)
4. Button positioned correctly at bottom
5. No unexpected empty spaces

### Example: Initiative Tracker

**Before (with 100vh)**:
```
┌─────────────────┐
│ Header          │
│ Few entries     │
│                 │ <- Empty space
│                 │
│ [Button]        │ <- Wrong position
└─────────────────┘
```

**After (with 100dvh)**:
```
┌─────────────────┐
│ Header          │
│ Few entries     │
│                 │
│                 │ <- Proper fill
│                 │
│        [Button] │ <- Correct position
└─────────────────┘
```

## Safe Areas and Notches

### iOS Devices with Notch

The system accounts for:
- Status bar area around notch
- Bottom indicator bar (home gesture area)
- Rounded corners

Using:
```css
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
```

### Android Devices

The system accounts for:
- Status bar
- Navigation bar (if present)
- Gesture areas

## Testing

### Test Scenarios

1. **Short Content Pages**:
   - Empty initiative tracker
   - Map page with few locations
   - Verify button at screen bottom

2. **Long Content Pages**:
   - Diary with many entries
   - Full initiative tracker
   - Verify scrolling works, button stays fixed

3. **Browser UI Transitions**:
   - Scroll down (address bar hides)
   - Scroll up (address bar shows)
   - Verify layout adjusts smoothly

4. **Different Devices**:
   - iPhone with notch (Pro, 14, 15)
   - iPhone without notch (SE)
   - Android phones
   - iPads

### Testing in DevTools

Chrome DevTools device simulation:
1. Open DevTools (F12)
2. Enable device toolbar (Ctrl+Shift+M)
3. Select mobile device
4. Note: `display-mode: standalone` won't trigger in browser
5. Must test on actual installed PWA

## Common Issues and Solutions

### Issue: Button Not at Bottom
**Cause**: Page not using `100dvh`
**Solution**: Ensure global.css has `min-height: 100dvh`

### Issue: Content Hidden Behind Button
**Cause**: Missing bottom padding
**Solution**: Ensure `--pwa-floating-menu-clearance` is applied

### Issue: Layout Jumps When Scrolling
**Cause**: Using `100vh` instead of `100dvh`
**Solution**: Browser UI changes affect `100vh` but `100dvh` adjusts smoothly

### Issue: Works in Browser, Not in PWA
**Cause**: PWA styles only apply in standalone mode
**Solution**: Test with app installed as PWA, not in browser

## Related Files

- `src/styles/global.css` - Main layout and viewport height rules
- `src/components/PWAFloatingMenu.astro` - Floating menu component
- `src/layouts/Layout.astro` - Base layout with PWA detection
- `docs/PWA_STATUS_BAR_GRADIENT.md` - Status bar styling

## References

- [CSS `dvh` units specification](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths)
- [Safe area insets](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [Display mode media query](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode)

## Changelog

### 2024-12-29: Dynamic Viewport Height Fix
- Changed from `100vh` to `100dvh` for viewport height
- Fixes button positioning on short pages (map, initiative tracker)
- Maintains backward compatibility with older browsers
- Addresses recurring bottom spacing issues in PWA mode
