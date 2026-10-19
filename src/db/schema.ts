// Database schema (Drizzle ORM, SQLite via libSQL).
//
// Mirrors the tables created earlier by Astro DB, column for column, with the same
// encodings: booleans are integers, JSON is stored as text, dates as ISO 8601 text.
// Changing this file does NOT change the database. Schema changes need a migration
// (see deploy/README.md) that is applied to preview first, then to live.

import { sql } from 'drizzle-orm';
import { customType, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const isISODateString = (value: string) => /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(value);

const date = customType<{ data: Date; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value) => value.toISOString(),
  fromDriver: (value) => new Date(isISODateString(value) ? value : `${value}Z`),
});

const json = <T = unknown>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType: () => 'text',
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => JSON.parse(value),
  })(name);

// Timestamp of the insert (Astro DB froze `new Date()` at build time instead).
const now = (name: string) => date(name).notNull().$defaultFn(() => new Date());
const bool = (name: string) => integer(name, { mode: 'boolean' });
const jsonArray = (name: string) => json<any[]>(name).notNull().default([]);

export const DiaryEntry = sqliteTable('DiaryEntry', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  session: integer('session').notNull(),
  tags: json<string[]>('tags').notNull(),
  coverImageUrl: text('coverImageUrl'),
  coverVideoUrl: text('coverVideoUrl'),
  galleryUrls: jsonArray('galleryUrls'),
  npcIds: jsonArray('npcIds'),
  locationIds: jsonArray('locationIds'),
  characterIds: jsonArray('characterIds'),
  questIds: jsonArray('questIds'),
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const Quest = sqliteTable('Quest', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(), // 'active' | 'completed' | 'failed'
  priority: text('priority').notNull(), // 'high' | 'medium' | 'low'
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const Character = sqliteTable('Character', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  class: text('class').notNull(),
  level: integer('level').notNull(),
  race: text('race').notNull(),
  player: text('player').notNull(),
  userId: text('userId'), // Foreign key to User - tracks ownership
  isActive: bool('isActive').notNull().default(true),
  avatarUrl: text('avatarUrl'),
  dndbeyondUrl: text('dndbeyondUrl'),
  stats: json('stats'),
  statsManuallyEdited: bool('statsManuallyEdited').notNull().default(false), // If true, sync won't override stats
  // HP tracking fields
  hp: integer('hp'), // Current HP
  maxHp: integer('maxHp'), // Maximum HP
  tempHp: integer('tempHp'), // Temporary HP
  // Death saves (when HP = 0)
  deathSaveSuccesses: integer('deathSaveSuccesses').notNull().default(0), // 0-3
  deathSaveFailures: integer('deathSaveFailures').notNull().default(0), // 0-3
  isStable: bool('isStable').notNull().default(false), // Whether character is stable at 0 HP
  // Additional character details
  gender: text('gender'),
  alignment: text('alignment'),
  background: text('background'),
  age: integer('age'),
  height: text('height'),
  weight: integer('weight'),
  eyes: text('eyes'),
  skin: text('skin'),
  hair: text('hair'),
  lastSyncedAt: date('lastSyncedAt'), // Last time character was synced from D&D Beyond
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const NPC = sqliteTable('NPC', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  race: text('race').notNull(),
  occupation: text('occupation'),
  location: text('location'), // Legacy text field for backward compatibility
  locationId: text('locationId'), // Foreign key to Location table
  description: text('description').notNull(),
  relationship: text('relationship').notNull(), // 'ally' | 'neutral' | 'enemy'
  notes: text('notes'),
  avatarUrl: text('avatarUrl'),
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const Location = sqliteTable('Location', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'city' | 'dungeon' | 'wilderness' | 'building' | 'other'
  description: text('description').notNull(),
  region: text('region'),
  visited: bool('visited').notNull().default(false),
  notes: text('notes'),
  imageUrl: text('imageUrl'), // Optional image for the location
  // Map coordinates (percentage-based for responsive positioning)
  mapX: integer('mapX'), // X coordinate (0-100)
  mapY: integer('mapY'), // Y coordinate (0-100)
  visibleOnMap: bool('visibleOnMap').notNull().default(false), // Whether pin is visible on map
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const User = sqliteTable('User', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  role: text('role').notNull().default('player'), // 'admin' | 'dungeonmaster' | 'player'
  firstName: text('firstName'), // First name for display
  profileImageUrl: text('profileImageUrl'), // Profile image URL
  characterIds: jsonArray('characterIds'), // Array of character IDs this user plays
  favoritePages: jsonArray('favoritePages'), // Array of favorite/quickstart page IDs (max 3)
  dicePresets: jsonArray('dicePresets'), // Saved dice rolls: { id, name, parts: [{ label, expr }] } (see lib/dice-notation)
  createdAt: now('createdAt'),
});

export const CampaignProgress = sqliteTable('CampaignProgress', {
  id: text('id').primaryKey(),
  currentLevel: integer('currentLevel').notNull(),
  progressPercent: integer('progressPercent').notNull(), // 0-100 in steps of 10
  heroImageUrl: text('heroImageUrl'), // Optional hero/banner image for dashboard
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const LibraryEntry = sqliteTable('LibraryEntry', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(), // Markdown content
  tags: jsonArray('tags'), // Array of tags for filtering
  locationId: text('locationId'), // Foreign key to Location table
  questIds: jsonArray('questIds'), // Array of Quest IDs
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const Faction = sqliteTable('Faction', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull(), // 'enemy' | 'suspicious' | 'neutral' | 'friendly' | 'respectful'
  progress: integer('progress').notNull().default(50), // 0-100 independent of status
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const PageSettings = sqliteTable('PageSettings', {
  id: text('id').primaryKey(),
  pageName: text('pageName').notNull().unique(), // 'dashboard' | 'characters' | 'diary' | ...
  heroImageUrl: text('heroImageUrl'), // Optional hero/banner image for the page
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const InitiativeTracker = sqliteTable('InitiativeTracker', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  initiative: integer('initiative').notNull(),
  type: text('type').notNull(), // 'character' | 'npc' | 'monster' | 'other'
  characterId: text('characterId'), // Foreign key to Character - for ownership checks
  hp: integer('hp'), // Current HP
  maxHp: integer('maxHp'), // Max HP
  tempHp: integer('tempHp'), // Temporary HP
  ac: integer('ac'), // Armor Class
  notes: text('notes'),
  creatureId: text('creatureId'), // Creature (bestiary stat block) it was added from; DM only
  conditions: jsonArray('conditions'), // ["Poisoned", "Exhaustion 2", …] (lib/conditions.ts); everyone sees them
  isActive: bool('isActive').notNull().default(true), // Whether this entry is in current combat
  // Death saves (when HP = 0)
  deathSaveSuccesses: integer('deathSaveSuccesses').notNull().default(0), // 0-3
  deathSaveFailures: integer('deathSaveFailures').notNull().default(0), // 0-3
  isStable: bool('isStable').notNull().default(false), // Whether character is stable at 0 HP
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

// Bestiary: stat blocks for monsters and named NPCs (DM/admin only, never sent to players).
// Numbers the app works with are columns; the descriptive parts keep their text word for word
// (see src/lib/statblock.ts for the shapes and the D&D Beyond paste import).
export const Creature = sqliteTable('Creature', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  typeLine: text('typeLine'), // "Small Fey (Goblinoid), Chaotic Neutral"
  ac: integer('ac'),
  acNote: text('acNote'), // e.g. "natural armor"
  hp: integer('hp'), // average
  hpFormula: text('hpFormula'), // "3d6"
  initiative: integer('initiative'), // bonus
  speed: text('speed'),
  abilities: json<Record<string, { score: number; mod: number; save: number }>>('abilities').notNull().default({}),
  details: jsonArray('details'), // [{ label: 'Senses', text: 'Darkvision 60 ft.; Passive Perception 9' }]
  sections: jsonArray('sections'), // [{ title: 'Actions', intro?, entries: [{ name, text }] }]
  cr: text('cr'), // "1/4"
  xp: integer('xp'),
  npcIds: jsonArray('npcIds'), // named NPCs that use this stat block
  notes: text('notes'), // DM notes
  sourceText: text('sourceText'), // the pasted stat block, as pasted
  srdKey: text('srdKey'), // copied from the SRD 5.2 library (src/data/srd-2024-creatures.json)
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const CombatState = sqliteTable('CombatState', {
  id: text('id').primaryKey(),
  currentRound: integer('currentRound').notNull().default(1),
  currentTurnIndex: integer('currentTurnIndex').notNull().default(0),
  status: text('status').notNull().default('stopped'), // 'active' | 'paused' | 'stopped'
  updatedAt: now('updatedAt'),
});

export const DiaryNote = sqliteTable('DiaryNote', {
  id: text('id').primaryKey(),
  diaryEntryId: text('diaryEntryId').notNull(), // Foreign key to DiaryEntry
  userId: text('userId').notNull(), // Foreign key to User - notes are user-specific
  content: text('content').notNull(),
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const DMScreenState = sqliteTable('DMScreenState', {
  id: text('id').primaryKey(),
  currentLocationId: text('currentLocationId'), // Foreign key to Location - currently displayed location
  spotlightNpcIds: jsonArray('spotlightNpcIds'), // Array of NPC IDs in spotlight
  locationHidden: bool('locationHidden').notNull().default(false), // Current location kept but not shown on the display
  hiddenNpcIds: jsonArray('hiddenNpcIds'), // Spotlight NPCs kept but not shown on the display
  npcsHidden: bool('npcsHidden').notNull().default(false), // All spotlight NPCs hidden at once (individual marks kept)
  focusNpcIds: jsonArray('focusNpcIds'), // Spotlight entries shown on their own (location, turn order, timer kept but not shown); empty = no focus
  customAssets: jsonArray('customAssets'), // Array of custom asset URLs
  showInitiativeTracker: bool('showInitiativeTracker').notNull().default(false),
  screenVisible: bool('screenVisible').notNull().default(true), // Content or placeholder on player display
  placeholderImageUrl: text('placeholderImageUrl'), // Wallpaper image when screen is hidden
  // Timer fields
  showTimer: bool('showTimer').notNull().default(false),
  timerDuration: integer('timerDuration').notNull().default(0), // Timer duration in seconds
  timerStartedAt: integer('timerStartedAt'), // Unix timestamp when timer started
  timerPausedAt: integer('timerPausedAt'), // Unix timestamp when timer was paused
  timerStatus: text('timerStatus').notNull().default('stopped'), // 'running' | 'paused' | 'stopped'
  updatedAt: now('updatedAt'),
});

export const Event = sqliteTable('Event', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  date: text('date').notNull(), // ISO date string (YYYY-MM-DD)
  time: text('time').notNull(), // Time string (HH:MM)
  duration: integer('duration'), // Duration in minutes
  hostId: text('hostId'), // Foreign key to User - the host of the event
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

export const TimelineEntry = sqliteTable('TimelineEntry', {
  id: text('id').primaryKey(),
  entryType: text('entryType').notNull().default('event'), // 'event' or 'label' (dividers like "100 years later")
  year: integer('year').notNull(), // Numeric year - required for positioning on timeline
  month: integer('month'), // Optional month (1-12) for fantasy calendar
  label: text('label'), // Label text for dividers (only for entryType='label')
  sortOrder: integer('sortOrder'), // For sorting entries and labels on timeline
  // Event-specific fields (not used for labels)
  headline: text('headline'), // Required for events, not used for labels
  shortDescription: text('shortDescription'),
  fullDescription: text('fullDescription'), // Markdown content
  imageUrl: text('imageUrl'), // Optional image for the entry
  // Connection IDs to other content (not used for labels)
  diaryEntryIds: jsonArray('diaryEntryIds'), // Array of DiaryEntry IDs
  libraryDocsEntryIds: jsonArray('libraryDocsEntryIds'), // Array of LibraryEntry IDs (docs)
  npcIds: jsonArray('npcIds'),
  locationIds: jsonArray('locationIds'),
  characterIds: jsonArray('characterIds'),
  questIds: jsonArray('questIds'),
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
});

// ── Music player ───────────────────────────────────────────────────────────
export const Playlist = sqliteTable('Playlist', {
  id: text('id').primaryKey(),
  ownerId: text('ownerId').notNull(), // User.id
  name: text('name').notNull(),
  visibility: text('visibility').notNull().default('private'), // 'public' | 'private'
  isSiteDefault: bool('isSiteDefault').notNull().default(false), // the one site playlist ("Tavern music")
  createdAt: now('createdAt'),
  updatedAt: now('updatedAt'),
}, (t) => [
  uniqueIndex('Playlist_one_site').on(t.isSiteDefault).where(sql`isSiteDefault = 1`),
]);

export const PlaylistTrack = sqliteTable('PlaylistTrack', {
  id: text('id').primaryKey(),
  playlistId: text('playlistId').notNull().references(() => Playlist.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  kind: text('kind').notNull(), // 'file' | 'youtube_video' | 'youtube_playlist'
  title: text('title').notNull(),
  ref: text('ref').notNull(), // upload URL for files, YouTube id for YouTube kinds
  durationSec: integer('durationSec'),
  createdAt: now('createdAt'),
});
