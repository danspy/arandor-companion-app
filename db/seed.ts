import { db, DiaryEntry, Quest, Character, NPC, Location, User } from 'astro:db';
import { hashPassword } from '../src/lib/auth';

export default async function seed() {
  // Seed Diary Entries
  await db.insert(DiaryEntry).values([
    {
      id: '1',
      date: '2025-10-15',
      title: 'The Journey Begins',
      content: 'Our party assembled at the Prancing Pony tavern in Waterdeep. We were tasked by Lord Neverember to investigate strange occurrences in the nearby ruins.',
      session: 1,
      tags: ['introduction', 'waterdeep'],
      createdAt: new Date('2025-10-15'),
      updatedAt: new Date('2025-10-15'),
    },
    {
      id: '2',
      date: '2025-10-22',
      title: 'Into the Ruins',
      content: 'Descended into the ancient ruins beneath the city. Encountered goblins and found a mysterious amulet with strange runes.',
      session: 2,
      tags: ['combat', 'discovery', 'ruins'],
      createdAt: new Date('2025-10-22'),
      updatedAt: new Date('2025-10-22'),
    }
  ]);

  // Seed Quests
  await db.insert(Quest).values([
    {
      id: '1',
      title: 'Investigate the Ruins',
      description: 'Explore the ancient ruins beneath Waterdeep and report findings to Lord Neverember',
      status: 'active',
      priority: 'high',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      title: 'Find the Missing Merchant',
      description: 'Locate Grimwald, a merchant who disappeared near the docks',
      status: 'active',
      priority: 'medium',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]);

  // Seed Characters
  await db.insert(Character).values([
    {
      id: '1',
      name: 'Thorin Ironforge',
      class: 'Fighter',
      level: 5,
      race: 'Dwarf',
      player: 'Player 1',
      stats: {
        strength: 16,
        dexterity: 12,
        constitution: 15,
        intelligence: 10,
        wisdom: 11,
        charisma: 8
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'Elara Moonwhisper',
      class: 'Wizard',
      level: 5,
      race: 'Elf',
      player: 'Player 2',
      stats: {
        strength: 8,
        dexterity: 14,
        constitution: 12,
        intelligence: 16,
        wisdom: 13,
        charisma: 10
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]);

  // Seed NPCs
  await db.insert(NPC).values([
    {
      id: '1',
      name: 'Lord Neverember',
      race: 'Human',
      occupation: 'Noble',
      location: 'Waterdeep',
      description: 'Ruler of Waterdeep, wealthy and influential',
      relationship: 'ally',
      notes: 'Gave us the quest to investigate the ruins',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'Grimwald the Merchant',
      race: 'Halfling',
      occupation: 'Merchant',
      location: 'Unknown',
      description: 'Missing merchant, last seen near the docks',
      relationship: 'neutral',
      notes: 'Subject of current quest',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]);

  // Seed Locations
  await db.insert(Location).values([
    {
      id: '1',
      name: 'Waterdeep',
      type: 'city',
      description: 'The City of Splendors, a bustling metropolis on the Sword Coast',
      region: 'Sword Coast',
      visited: true,
      notes: 'Our current base of operations',
      mapX: 30,
      mapY: 36,
      visibleOnMap: true, // Make visible for demo
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'Ancient Ruins',
      type: 'dungeon',
      description: 'Mysterious ruins beneath Waterdeep, origin unknown',
      region: 'Waterdeep Undermountain',
      visited: true,
      notes: 'Found goblin presence and a mysterious amulet',
      mapX: 28,
      mapY: 42,
      visibleOnMap: true, // Make visible for demo
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]);

  // Seed Admin User (username: admin, password: admin)
  await db.insert(User).values([
    {
      id: '1',
      username: 'admin',
      passwordHash: await hashPassword('admin'),
      createdAt: new Date(),
    }
  ]);

  console.log('Database seeded successfully!');
}
