# D&D Beyond HP Sync Feature

## Overview

The Initiative Tracker now supports real-time synchronization of character Hit Points (HP) from D&D Beyond. This allows the DM to automatically keep character HP up-to-date in the initiative tracker without manual entry.

## Features

- **Automatic HP Sync**: When combat is active, character HP is automatically synced from D&D Beyond every 30 seconds
- **Manual Sync**: DM can trigger immediate HP sync with the "Sync HP" button
- **Current HP, Max HP, and Temp HP**: All three HP values are synced from D&D Beyond
- **Initiative Tracker Integration**: Synced HP automatically updates in the initiative tracker during combat
- **Character Database**: HP values are stored in the character database for persistence

## Requirements

### Character Setup

For HP syncing to work, characters must have:
1. A valid D&D Beyond character URL set in their profile
2. The D&D Beyond character sheet must be set to **public** (not private)

### D&D Beyond Character Sheet Settings

To make a character sheet public on D&D Beyond:
1. Open your character sheet on dndbeyond.com
2. Click "Edit" or "Manage Character"
3. Go to "Manage Character" > "Privacy"
4. Select "Public" for the character sheet visibility
5. Save changes

## How It Works

### HP Data Extraction

The system fetches HP data from D&D Beyond's character API and calculates:

- **Max HP**: `overrideHitPoints` (if set and > 0) OR `baseHitPoints + bonusHitPoints`
- **Current HP**: `maxHp - removedHitPoints`
- **Temp HP**: `temporaryHitPoints`

Note: `overrideHitPoints` is only used if it's a positive number greater than 0. If it's 0, null, or undefined, the system falls back to calculating max HP as `baseHitPoints + bonusHitPoints`.

### Automatic Syncing During Combat

When combat status is set to "Active":
1. HP is immediately synced for all characters with D&D Beyond URLs
2. HP continues to sync automatically every 10 seconds (fast updates)
3. Syncing works across all tools: Initiative Tracker, DM Screen, and Player Display
4. Synced HP updates both the Character database and Initiative Tracker
5. Syncing stops when combat is paused or stopped

### Manual Syncing

The DM can trigger manual HP sync at any time:
1. Click the "Sync HP" button in the Initiative Tracker
2. All characters with D&D Beyond URLs are synced
3. A confirmation message shows how many characters were synced
4. The page reloads to display updated HP values

## API Endpoints

### Sync Single Character HP
```
POST /api/characters/sync-hp
Body: { characterId: "character-id" }
```
Syncs HP for a specific character from their D&D Beyond URL.

### Sync All Initiative Characters HP
```
POST /api/initiative/sync-hp
```
Syncs HP for all characters in the initiative tracker that have D&D Beyond URLs.
Returns sync results with success/failure status for each character.

### Fetch D&D Beyond Character Data
```
POST /api/characters/dndbeyond
Body: { url: "https://www.dndbeyond.com/characters/123456" }
```
Fetches full character data from D&D Beyond, including HP, stats, and other details.

## Database Schema

### Character Table Updates

New fields added to the `Character` table:
```typescript
hp: number | null        // Current HP
maxHp: number | null     // Maximum HP
tempHp: number | null    // Temporary HP
```

## Usage Guide

### Initial Setup

1. **Add D&D Beyond URLs to Characters**:
   - Go to Characters page
   - Edit each character
   - Paste their D&D Beyond character URL (e.g., `https://www.dndbeyond.com/characters/123456`)
   - Save the character

2. **Verify Character Sheets are Public**:
   - Ensure all character sheets on D&D Beyond are set to public
   - Test by clicking the D&D Beyond URL from the character page

### During Combat

1. **Start Combat**:
   - Add characters to the initiative tracker
   - Click "Start" to activate combat tracking
   - HP will automatically sync from D&D Beyond immediately and every 10 seconds

2. **Manual Sync** (if needed):
   - Click "Sync HP" button at any time
   - Useful for immediate updates or when players take damage

3. **Monitor Syncing**:
   - Check browser console for sync logs: "HP synced: X of Y characters"
   - Failed syncs are logged with error details
   - Syncing works in Initiative Tracker, DM Screen, and Player Display

### Troubleshooting

**HP Not Syncing?**

1. Verify character has D&D Beyond URL in their profile
2. Check that D&D Beyond character sheet is set to public
3. Test the URL by opening it in a browser
4. Check browser console for error messages
5. Try manual sync to see specific error messages

**Sync Failing for Specific Character?**

- The character may be private or the URL may be incorrect
- D&D Beyond API may be temporarily unavailable
- Check the character ID in the URL is correct

**Syncing Too Slow/Fast?**

The sync interval is set to 10 seconds in the code. To change:
- Edit `src/pages/tools/initiative.astro`, `src/pages/tools/dm-screen.astro`, and `src/pages/display.astro`
- Find `HP_SYNC_INTERVAL` constant (currently 10000 ms)
- Adjust as needed (minimum recommended: 5 seconds to avoid rate limiting)

## Technical Notes

### D&D Beyond API

- Uses D&D Beyond's unofficial character service API (v5)
- API endpoint: `https://character-service.dndbeyond.com/character/v5/character/{id}`
- This is an internal API used by D&D Beyond's own site
- **Note**: This API is not officially documented and may change without notice

### Rate Limiting

- Automatic syncing occurs every 30 seconds to avoid overwhelming the API
- Multiple characters are synced in sequence (not parallel) to be respectful of D&D Beyond's servers
- Consider increasing the interval if you have many characters

### Error Handling

- Individual character sync failures don't prevent other characters from syncing
- Errors are logged to console but don't interrupt combat tracking
- Failed syncs can be retried with manual sync button

## Future Enhancements

Possible improvements for future versions:

- [ ] Configurable sync interval in UI
- [ ] Sync status indicator showing last sync time
- [ ] Per-character sync status and errors
- [ ] Support for syncing AC and other stats
- [ ] Webhook support for instant updates when HP changes in D&D Beyond
- [ ] Bulk character import from D&D Beyond campaign
- [ ] Sync other combat-relevant stats (conditions, spell slots, etc.)
- [ ] Add characterId field to InitiativeTracker for robust character matching

## Technical Limitations

### Character Matching in Initiative Tracker

Currently, the system matches characters in the initiative tracker to their database records by **name**. This has some limitations:

- **Multiple characters with same name**: If two characters have identical names, only one will be matched
- **Name changes**: If a character's name is changed, the initiative entry won't match until it's re-added
- **Case sensitivity**: Names must match exactly (though this is typically not an issue)

**Recommended Workaround**: Ensure each character has a unique name. A future enhancement will add a `characterId` field to the InitiativeTracker table for direct ID-based matching.

## Migration

No migration is needed. The new HP fields are optional:
- Existing characters continue to work without HP data
- HP can be added manually or synced from D&D Beyond
- Initiative tracker displays HP when available, falls back to health status for players

## See Also

- [Initiative Tracker Migration Guide](MIGRATION_GUIDE_initiative_tracker.md)
- [DM Screen Usage Guide](DM_SCREEN_USAGE_GUIDE.md)
- [Architecture Overview](ARCHITECTURE.md)
