import { defineDb, defineTable, column } from 'astro:db';

const DiaryEntry = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    date: column.text(),
    title: column.text(),
    content: column.text(),
    summary: column.text({ optional: true }),
    podcastAudioUrl: column.text({ optional: true }),
    session: column.number(),
    tags: column.json(),
    coverImageUrl: column.text({ optional: true }),
    coverVideoUrl: column.text({ optional: true }),
    npcIds: column.json({ default: [] }),
    locationIds: column.json({ default: [] }),
    characterIds: column.json({ default: [] }),
    questIds: column.json({ default: [] }),
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const Quest = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    title: column.text(),
    description: column.text(),
    status: column.text(), // 'active' | 'completed' | 'failed'
    priority: column.text(), // 'high' | 'medium' | 'low'
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const Character = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text(),
    class: column.text(),
    level: column.number(),
    race: column.text(),
    player: column.text(),
    userId: column.text({ optional: true }), // Foreign key to User - tracks ownership
    isActive: column.boolean({ default: true }),
    avatarUrl: column.text({ optional: true }),
    dndbeyondUrl: column.text({ optional: true }),
    stats: column.json({ optional: true }),
    // HP tracking fields
    hp: column.number({ optional: true }), // Current HP
    maxHp: column.number({ optional: true }), // Maximum HP
    tempHp: column.number({ optional: true }), // Temporary HP
    // Additional character details
    gender: column.text({ optional: true }),
    alignment: column.text({ optional: true }),
    background: column.text({ optional: true }),
    age: column.number({ optional: true }),
    height: column.text({ optional: true }),
    weight: column.number({ optional: true }),
    eyes: column.text({ optional: true }),
    skin: column.text({ optional: true }),
    hair: column.text({ optional: true }),
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const NPC = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text(),
    race: column.text(),
    occupation: column.text({ optional: true }),
    location: column.text({ optional: true }), // Legacy text field for backward compatibility
    locationId: column.text({ optional: true }), // Foreign key to Location table
    description: column.text(),
    relationship: column.text(), // 'ally' | 'neutral' | 'enemy'
    notes: column.text({ optional: true }),
    avatarUrl: column.text({ optional: true }),
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const Location = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text(),
    type: column.text(), // 'city' | 'dungeon' | 'wilderness' | 'building' | 'other'
    description: column.text(),
    region: column.text({ optional: true }),
    visited: column.boolean({ default: false }),
    notes: column.text({ optional: true }),
    imageUrl: column.text({ optional: true }), // Optional image for the location
    // Map coordinates (percentage-based for responsive positioning)
    mapX: column.number({ optional: true }), // X coordinate (0-100)
    mapY: column.number({ optional: true }), // Y coordinate (0-100)
    visibleOnMap: column.boolean({ default: false }), // Whether pin is visible on map (default hidden)
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const User = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    username: column.text({ unique: true }),
    passwordHash: column.text(),
    role: column.text({ default: 'player' }), // 'admin' | 'dungeonmaster' | 'player'
    firstName: column.text({ optional: true }), // First name for display
    profileImageUrl: column.text({ optional: true }), // Profile image URL
    characterIds: column.json({ default: [] }), // Array of character IDs this user plays
    favoritePages: column.json({ default: [] }), // Array of favorite/quickstart page IDs (max 3)
    createdAt: column.date({ default: new Date() }),
  }
});

const CampaignProgress = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    currentLevel: column.number(),
    progressPercent: column.number(), // 0-100 in steps of 10
    heroImageUrl: column.text({ optional: true }), // Optional hero/banner image for dashboard
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const LibraryEntry = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    title: column.text(),
    content: column.text(), // Markdown content
    tags: column.json({ default: [] }), // Array of tags for filtering
    locationId: column.text({ optional: true }), // Foreign key to Location table
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const Faction = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text(),
    status: column.text(), // 'enemy' | 'suspicious' | 'neutral' | 'friendly' | 'respectful'
    progress: column.number({ default: 50 }), // 0-100 independent of status
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const PageSettings = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    pageName: column.text({ unique: true }), // 'dashboard' | 'characters' | 'diary' | 'library' | 'locations' | 'npcs' | 'quests'
    heroImageUrl: column.text({ optional: true }), // Optional hero/banner image for the page
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const InitiativeTracker = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text(),
    initiative: column.number(),
    type: column.text(), // 'character' | 'npc' | 'monster' | 'other'
    characterId: column.text({ optional: true }), // Foreign key to Character - links to character for ownership checks
    hp: column.number({ optional: true }), // Current HP
    maxHp: column.number({ optional: true }), // Max HP
    tempHp: column.number({ optional: true }), // Temporary HP
    ac: column.number({ optional: true }), // Armor Class
    notes: column.text({ optional: true }),
    isActive: column.boolean({ default: true }), // Whether this entry is in current combat
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const CombatState = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    currentRound: column.number({ default: 1 }),
    currentTurnIndex: column.number({ default: 0 }),
    status: column.text({ default: 'stopped' }), // 'active' | 'paused' | 'stopped'
    updatedAt: column.date({ default: new Date() }),
  }
});

// Export tables for use in other modules
export { 
  DiaryEntry, 
  Quest, 
  Character, 
  NPC, 
  Location, 
  User, 
  CampaignProgress, 
  LibraryEntry, 
  Faction, 
  PageSettings,
  InitiativeTracker,
  CombatState,
  DMScreenState,
  Event,
};

const DiaryNote = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    diaryEntryId: column.text(), // Foreign key to DiaryEntry
    userId: column.text(), // Foreign key to User - ensures notes are user-specific
    content: column.text(),
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const DMScreenState = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    currentLocationId: column.text({ optional: true }), // Foreign key to Location - currently displayed location
    spotlightNpcIds: column.json({ default: [] }), // Array of NPC IDs in spotlight
    customAssets: column.json({ default: [] }), // Array of custom asset URLs
    showInitiativeTracker: column.boolean({ default: false }), // Whether to show initiative tracker on player display
    screenVisible: column.boolean({ default: true }), // Whether to show content or placeholder on player display
    placeholderImageUrl: column.text({ optional: true }), // Placeholder/wallpaper image when screen is hidden
    // Timer fields
    showTimer: column.boolean({ default: false }), // Whether to show timer on player display
    timerDuration: column.number({ default: 0 }), // Timer duration in seconds
    timerStartedAt: column.number({ optional: true }), // Timestamp when timer started (Unix timestamp)
    timerPausedAt: column.number({ optional: true }), // Timestamp when timer was paused (Unix timestamp)
    timerStatus: column.text({ default: 'stopped' }), // 'running' | 'paused' | 'stopped'
    updatedAt: column.date({ default: new Date() }),
  }
});

const Event = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    title: column.text(),
    description: column.text({ optional: true }),
    date: column.text(), // ISO date string (YYYY-MM-DD)
    time: column.text(), // Time string (HH:MM)
    duration: column.number({ optional: true }), // Duration in minutes
    hostId: column.text({ optional: true }), // Foreign key to User - the host of the event
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

export default defineDb({
  tables: {
    DiaryEntry,
    Quest,
    Character,
    NPC,
    Location,
    User,
    CampaignProgress,
    LibraryEntry,
    Faction,
    PageSettings,
    InitiativeTracker,
    CombatState,
    DiaryNote,
    DMScreenState,
    Event,
  }
});
