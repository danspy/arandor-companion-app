# Map Pin Visibility Behavior

## Overview
Map pins on the interactive map now have a two-tier visibility system based on the `visibleOnMap` and `visited` fields in the Location table.

## Visibility States

### 1. Not Visible (Hidden)
- **Condition**: `visibleOnMap = false`
- **Behavior**: Pin is **not rendered** on the map at all
- **Use Case**: Locations that players haven't discovered yet, or secret locations that the DM wants to keep hidden

### 2. Visible but Not Visited
- **Condition**: `visibleOnMap = true` AND `visited = false`
- **Behavior**: Pin is rendered with **50% opacity** (semi-transparent)
- **Use Case**: Locations that are known to players but haven't been visited yet

### 3. Visible and Visited
- **Condition**: `visibleOnMap = true` AND `visited = true`
- **Behavior**: Pin is rendered with **full opacity** (100%, no transparency)
- **Use Case**: Locations that players have already visited

## Database Schema

```typescript
Location {
  visibleOnMap: boolean (default: false) // Controls if pin appears on map at all
  visited: boolean (default: false)       // Controls opacity when pin is visible
}
```

## Default Behavior
- **New locations** have `visibleOnMap = false` by default, meaning they are hidden until explicitly shown
- The "Show pin on map" checkbox in the location form controls the `visibleOnMap` field
- The "Mark as visited" checkbox controls the `visited` field

## Implementation Details

### Code Changes (src/pages/map.astro)

1. **renderPins() function**: Only renders locations where `visibleOnMap === true`
2. **createPin() function**: Sets opacity based on `visited` status:
   - `visited = true`: opacity = 1.0 (full)
   - `visited = false`: opacity = 0.5 (semi-transparent)

### Removed Features
- Removed the old behavior where hidden pins were rendered with 30% opacity
- Removed edit mode code that tried to toggle visibility of hidden pins (since they're no longer rendered)

## Usage Example

```javascript
// Example location data
{
  id: "loc-1",
  name: "Mystery Cave",
  visibleOnMap: false,  // Pin will NOT be rendered at all
  visited: false
}

{
  id: "loc-2", 
  name: "Town Square",
  visibleOnMap: true,   // Pin will be rendered
  visited: false        // Pin will be 50% transparent
}

{
  id: "loc-3",
  name: "Dragon's Lair", 
  visibleOnMap: true,   // Pin will be rendered
  visited: true         // Pin will be fully opaque
}
```

## Migration Notes
- Existing locations with `visibleOnMap = false` will no longer appear on the map (previously they were semi-transparent)
- DMs may need to update existing locations to set `visibleOnMap = true` if they want them to appear on the map
