# DM Screen Usage Guide

## Overview

The DM Screen is a powerful tool for Dungeon Masters to control what players see on a second display during game sessions. It allows you to showcase location images, highlight NPCs, and display the initiative tracker in real-time.

## Accessing the DM Screen

### Prerequisites
- You must be logged in with **Admin** or **Dungeon Master** role
- Navigate to **Tools** from the main menu
- Click on the **DM Screen** card

## DM Control Panel

The DM control panel (`/tools/dm-screen`) is where you manage what players see on their display screen.

### Features

#### 1. Player Display Link
At the top of the page, you'll see a shareable link for the player display:
- **Copy**: Click to copy the URL to your clipboard
- **Open**: Opens the player display in a new tab/window

**Tip**: Open this URL on a second monitor, TV, or tablet that your players can see during the session.

#### 2. Location Control
- Select a location from the dropdown to display its mood image to players
- Preview shows what players will see
- If a location has an image, it will be displayed with an info overlay
- If no image is available, a placeholder is shown

#### 3. NPC Spotlight
- Select NPCs to highlight on the player display
- Add multiple NPCs to create a group spotlight
- Click the X button next to an NPC to remove them from spotlight
- NPCs are displayed in a grid with their portraits and information

#### 4. Initiative Tracker Toggle
- Check the box to show the initiative tracker on the player display
- When enabled, players can see:
  - Current initiative order
  - Current turn indicator
  - Health status (Healthy, Injured, Hurt, Bloodied, Dead)
  - Round counter
- Real-time synchronization with the main initiative tracker

#### 5. Quick Actions
- **Clear Player Display**: Removes all content (location, NPCs, and initiative tracker) from the player display

## Player Display Screen

The player display screen (`/display`) is a public page that requires no authentication. This is designed to be shown on a second screen visible to all players.

### Display Modes

The player display uses a dynamic layout system that adapts based on the number of active elements:

**Single Selection (Fullscreen - 100%):**
- **Location only**: Fullscreen location image with name and info overlay
- **NPCs only**: Fullscreen NPC grid with portraits and details
- **Initiative only**: Fullscreen initiative tracker with health status

**Two Selections (Side-by-Side 60/40):**
- **Location + Initiative**: Location left (60%), Initiative right (40%)
- **NPCs + Initiative**: NPCs left (60%), Initiative right (40%)
- **Location + NPCs**: Both vertically stacked, fullscreen (50% each)

**All Three Selected (Side-by-Side 60/40):**
- **Left Panel (60%)**: Location top (50%) + NPCs bottom (50%)
- **Right Panel (40%)**: Initiative tracker (100%)

**Layout Rules:**
- Initiative tracker **always** appears on the right when combined with other elements
- Single items use 100% of screen space
- Everything fits on screen - no vertical scrolling required
- Responsive to screen size

### Auto-Refresh

The player display automatically polls for updates every 2 seconds, ensuring it stays synchronized with the DM's control panel without manual refreshing.

## Usage Scenarios

### Scenario 1: Arriving at a New Location
1. Select the location from the Location Control dropdown
2. The player display immediately shows the location's image in fullscreen
3. Players see the mood and atmosphere of where they are

### Scenario 2: NPC Encounter
1. Add relevant NPCs to the spotlight
2. Players can see the NPCs they're interacting with
3. Use this for merchants, quest givers, or important story characters

### Scenario 3: Combat
1. Set up combat in the Initiative Tracker (`/tools/initiative`)
2. Toggle "Show initiative tracker on player display"
3. Players can now see:
   - Who's turn it is (highlighted in yellow)
   - Initiative order
   - Health status of characters
   - Current round number
4. Use Next/Prev Turn buttons in the Initiative Tracker to advance combat

### Scenario 4: Combined Display
The dynamic layout system handles all combinations:

**During Exploration:**
- Show location + NPCs side-by-side to display the tavern with its inhabitants

**During Combat at a Location:**
- Show location + initiative side-by-side (60/40) to keep the battlefield visible during combat

**Intense Combat Scene:**
- Show all three: location + NPCs on left (60%), initiative on right (40%)
- Perfect for boss fights where location, enemy portraits, and turn order are all important

**Pure Combat Focus:**
- Show only initiative tracker in fullscreen for mechanical combat without visual distractions

The layout automatically adjusts when the DM adds or removes elements, always using the optimal space for the content shown.

## Tips & Best Practices

### For Dungeon Masters

1. **Pre-load Locations**: Add location images before the session for smoother gameplay
2. **Test Before Session**: Open the player display on your second screen before players arrive
3. **Prepare NPC Portraits**: Upload NPC avatars to make the spotlight more visually engaging
4. **Clear Between Scenes**: Use "Clear Player Display" when transitioning between major scenes
5. **Combat Setup**: Start combat in the Initiative Tracker first, then toggle the display

### For Setup

1. **Second Monitor**: Connect a TV or monitor to your laptop
2. **Tablet/iPad**: Open the player display URL on a tablet placed in the center of the table
3. **TV Browser**: Some smart TVs can open web pages directly
4. **Laptop as Display**: Use an old laptop as a dedicated player display

## Technical Details

### Real-Time Synchronization
- DM control panel updates are sent to the server immediately
- Player display polls every 2 seconds for updates
- No manual refresh needed
- Changes appear within 2 seconds

### Browser Compatibility
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- No special permissions or installations needed
- Works on desktop, tablet, and mobile devices

### Network Requirements
- Both DM and player display must be on the same network
- Or use port forwarding/tunneling to access remotely
- No internet connection required if hosted locally

## Troubleshooting

### Player Display Not Updating
- Check that the player display is accessing the correct URL
- Verify both devices are on the same network
- Refresh the player display page
- Check browser console for errors

### Location Image Not Showing
- Verify the location has an image URL set
- Check that the image URL is accessible
- Try re-selecting the location in the control panel

### Initiative Tracker Not Appearing
- Ensure the "Show initiative tracker" checkbox is enabled
- Verify there are active entries in the Initiative Tracker
- Check that combat status is not "stopped"

### Authentication Issues
- The player display (`/display`) is public and requires no login
- The DM control panel requires Admin or Dungeon Master role
- If redirected to login, verify your user role

## Future Enhancements

Planned features for future versions:
- Custom asset uploads (images, PDFs, etc.)
- Multiple player display layouts
- Picture-in-picture mode (combine location + initiative)
- Handout distribution
- Music/ambient sound control
- Player notes and annotations
- Session recording and playback

## Support

For issues or feature requests, please check the repository's issue tracker or documentation.
