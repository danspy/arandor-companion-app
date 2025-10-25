import { defineDb, defineTable, column } from 'astro:db';

const DiaryEntry = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    date: column.text(),
    title: column.text(),
    content: column.text(),
    session: column.number(),
    tags: column.json(),
    coverImageUrl: column.text({ optional: true }),
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
    avatarUrl: column.text({ optional: true }),
    dndbeyondUrl: column.text({ optional: true }),
    stats: column.json({ optional: true }),
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
    createdAt: column.date({ default: new Date() }),
  }
});

const CampaignProgress = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    currentLevel: column.number(),
    progressPercent: column.number(), // 0-100 in steps of 10
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
  }
});
