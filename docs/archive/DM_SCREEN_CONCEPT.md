# DM Screen Tool - Feature Concept

## Overview

The DM Screen is a comprehensive session management tool designed exclusively for Dungeon Masters and Administrators. It provides a unified interface for running game sessions with quick access to essential information, visual aids, and real-time tools.

## Target Users

- **Dungeon Masters** - Primary users who run game sessions
- **Administrators** - Full access to all DM features

## Core Features

### 1. Location Display Panel

**Purpose:** Provide instant visual reference for the current scene/location

**Features:**
- Display current location image in prominent position
- Show location name, type, and region
- Quick-access button to toggle between recent locations
- Support for multiple images per location (alternate views, maps, etc.)
- Ability to mark a location as "current" for session tracking

**Use Cases:**
- Display tavern interior when party enters
- Show dungeon map during exploration
- Present city overview for urban adventures

### 2. NPC Quick Reference

**Purpose:** Access NPC portraits and information during encounters

**Features:**
- Grid or carousel view of NPCs at current location
- Display NPC portrait/avatar prominently
- Show key information: name, race, occupation, relationship status
- Quick access to full NPC notes and description
- Filter NPCs by location or relationship (ally/neutral/enemy)
- "In Scene" toggle to mark NPCs currently interacting with party

**Use Cases:**
- Show merchant portrait during shopping scene
- Display enemy combatant during battle
- Reference NPC appearance during social encounters

### 3. Initiative Tracker Integration

**Purpose:** Seamless combat management within DM Screen

**Features:**
- Embedded view of initiative tracker
- Synchronized with main initiative tracker
- Compact display mode for space efficiency
- Quick HP adjustment controls
- Turn indicator highlighting
- Add combatant button for quick enemy additions

**Integration Points:**
- Link to full initiative tracker page
- Real-time sync with existing initiative system
- Combat state management (active/paused/stopped)

### 4. Session Quick Reference Panel

**Purpose:** Access critical campaign information at a glance

**Features:**
- **Active Quests:** Display current active quests with status
- **Party Status:** Show character HP status indicators (healthy/hurt/bloodied)
- **Current Session:** Display session number and date
- **Notes:** Quick notes field for session tracking
- **Faction Standings:** Show key faction relationships

**Layout:**
- Collapsible sidebar or bottom panel
- Persistent across screen navigation
- Minimal, information-dense design

### 5. Quick Actions Toolbar

**Purpose:** Rapid access to common DM actions

**Features:**
- Create diary entry for current session
- Add NPC to scene
- Mark location as visited
- Update quest status
- Quick dice roller (future integration)
- Pause/resume session timer (future feature)

## User Interface Design

### Layout Concept

```
┌─────────────────────────────────────────────────────┐
│ DM Screen                          [Actions] [Close] │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────────┐  ┌─────────────────────────┐ │
│  │                  │  │ Initiative Tracker      │ │
│  │  Current         │  │                         │ │
│  │  Location        │  │ 1. Dragon (HP: 180)     │ │
│  │  Image           │  │ 2. Fighter (HP: 45)     │ │
│  │                  │  │ 3. Wizard (HP: 32)      │ │
│  │                  │  │                         │ │
│  └──────────────────┘  │ [Next Turn] [Add]       │ │
│                         └─────────────────────────┘ │
│  Location: Tavern                                   │
│                                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ NPCs in Scene                               │   │
│  │ ┌───┐ ┌───┐ ┌───┐                          │   │
│  │ │👤│ │👤│ │👤│                          │   │
│  │ └───┘ └───┘ └───┘                          │   │
│  │ Bartender  Guard   Merchant               │   │
│  └─────────────────────────────────────────────┘   │
│                                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ Quick Info                                  │   │
│  │ Active Quests: 3 | Party Level: 5          │   │
│  │ Session #12 | Status: In Progress          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Responsive Design

- **Desktop:** Multi-column layout with all panels visible
- **Tablet:** Collapsible panels with tabs
- **Mobile:** Single panel view with bottom navigation

### Color Scheme

- Follow existing Arandor theme (burgundy/gold primary colors)
- Use subtle backgrounds to reduce eye strain during long sessions
- High contrast for important information (HP, initiative order)
- Dark mode optimized for low-light gaming environments

## Technical Implementation

### Database Requirements

**No new tables required.** Leverage existing schema:
- `Location` - for location images and data
- `NPC` - for character information and portraits
- `InitiativeTracker` - for combat management
- `Quest` - for quest status
- `Character` - for party information
- `PageSettings` - for DM Screen configuration

### New Fields Consideration

Optional additions to existing tables:
- `Location.isCurrent` (boolean) - Mark currently displayed location
- `NPC.inScene` (boolean) - Mark NPCs currently in active scene
- `DMScreenSettings` table - Store DM Screen layout preferences

### API Endpoints

Reuse existing endpoints:
- `GET /api/locations` - Fetch locations
- `GET /api/npcs` - Fetch NPCs (with location filter)
- `GET /api/initiative` - Fetch initiative tracker
- `GET /api/characters` - Fetch party status
- `GET /api/quests` - Fetch active quests

New endpoint (optional):
- `PUT /api/dm-screen/current-location` - Set current location
- `PUT /api/dm-screen/scene-npcs` - Update NPCs in scene

### Page Structure

```
src/pages/tools/dm-screen.astro
  - Main DM Screen interface
  - Role check: dungeonmaster or admin only
  - Real-time data fetching
  - Responsive layout components
```

### Component Architecture

Reusable components:
- `LocationDisplay.astro` - Location image viewer
- `NPCQuickCard.astro` - Compact NPC display
- `InitiativePanel.astro` - Embedded initiative view
- `QuickInfoPanel.astro` - Session information panel

## User Experience Flow

### Opening DM Screen

1. Navigate to Tools page
2. Click "DM Screen" card (visible to DM/Admin only)
3. DM Screen opens in full-screen or modal view
4. Auto-loads last used location (or prompts to select)

### During Session

1. DM updates current location → Image updates automatically
2. DM adds NPCs to scene → Portraits appear in panel
3. Combat starts → Initiative tracker embedded view activates
4. DM takes notes → Quick notes saved to session
5. DM updates quest status → Quick info panel reflects changes

### Session End

1. DM can export session notes to diary entry
2. Clear "in scene" markers for next session
3. Save DM Screen state for next time

## Future Enhancements

### Phase 2 Features

- **Session Timer:** Track real-time session duration
- **Dice Roller Integration:** Quick rolls within DM Screen
- **Music/Ambient Controls:** Playlist management for atmosphere
- **Player View Sync:** Optional second screen for players

### Phase 3 Features

- **AI Session Assistant:** Suggest NPCs, generate descriptions
- **Combat Log:** Automatic recording of combat actions
- **Encounter Builder:** Quick encounter setup with CR calculation
- **Multi-Monitor Support:** Dedicated layouts for multiple displays

### Integration Possibilities

- **D&D Beyond:** Import character sheets, monsters
- **Roll20/Foundry VTT:** Sync initiative, share maps
- **Discord Bot:** Broadcast updates to game channel
- **Mobile Companion:** Remote control from tablet/phone

## Implementation Priority

### Must Have (MVP)

1. Location image display
2. NPC quick reference with portraits
3. Initiative tracker integration
4. Basic session info panel

### Should Have (v1.1)

1. Quick actions toolbar
2. Collapsible panels
3. Current location toggle
4. NPC filtering by location

### Nice to Have (v2.0)

1. Session timer
2. Dice roller integration
3. Export session notes
4. Custom layouts

## Success Metrics

- **Usage:** % of DM sessions using DM Screen
- **Efficiency:** Reduced time searching for NPC/location info
- **Feedback:** Positive user feedback from DMs
- **Integration:** Initiative tracker usage increase
- **Sessions:** Diary entries created from DM Screen

## Security & Permissions

- **Access Control:** Strict DM/Admin only
- **Data Privacy:** No exposure of DM-only notes to players
- **Session Isolation:** Each campaign has independent DM Screen state
- **Audit Log:** Track DM Screen usage for debugging

## Development Roadmap

### Phase 1: Foundation (2-3 weeks)

- [ ] Create `/tools/dm-screen` page with auth check
- [ ] Implement location display panel
- [ ] Add NPC quick reference grid
- [ ] Embed initiative tracker view
- [ ] Basic styling and responsive layout

### Phase 2: Polish (1-2 weeks)

- [ ] Add quick info panel
- [ ] Implement quick actions toolbar
- [ ] Add filters and toggles
- [ ] Optimize performance
- [ ] User testing and feedback

### Phase 3: Enhancement (2-3 weeks)

- [ ] Add session timer
- [ ] Integrate dice roller
- [ ] Export to diary functionality
- [ ] Custom layout preferences
- [ ] Advanced features based on feedback

## Related Documentation

- [Initiative Tracker](./MIGRATION_GUIDE_initiative_tracker.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Authentication System](../src/lib/auth.ts)

## Feedback & Iteration

This is a living document. As DMs use the tool, we'll gather feedback and iterate on:
- Feature priority
- UI/UX improvements
- Performance optimizations
- Integration opportunities

**Next Steps:**
1. Review concept with primary DM users
2. Create wireframes/mockups
3. Prioritize Phase 1 features
4. Begin development sprint
