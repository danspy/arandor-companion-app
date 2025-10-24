import { defineDb, defineTable, column } from 'astro:db';

const DiaryEntry = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    date: column.text(),
    title: column.text(),
    content: column.text(),
    session: column.number(),
    tags: column.json(),
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
    location: column.text({ optional: true }),
    description: column.text(),
    relationship: column.text(), // 'ally' | 'neutral' | 'enemy'
    notes: column.text({ optional: true }),
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

export default defineDb({
  tables: {
    DiaryEntry,
    Quest,
    Character,
    NPC,
    Location,
    User,
  }
});
