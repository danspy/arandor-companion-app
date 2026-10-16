import { db, DiaryEntry, Quest, Character, NPC, Location, User, CampaignProgress } from '../src/db';
import { hashPassword } from '../src/lib/auth';

// Seeds an empty development database: npm run db:dev
export default async function seed() {
  // Only seed if database is empty (check if User table has any records)
  // This preserves existing data during deployments while allowing initial setup
  const existingUsers = await db.select().from(User).limit(1);
  
  if (existingUsers.length > 0) {
    console.log('Database already seeded - skipping seed to preserve existing data');
    return;
  }

  console.log('Database is empty - seeding initial data...');

  // Seed Diary Entries
  await db.insert(DiaryEntry).values([
    {
      id: '1',
      date: '2025-10-15',
      title: 'The Journey Begins',
      content: 'Our party assembled at the Prancing Pony tavern in Waterdeep. We were tasked by Lord Neverember to investigate strange occurrences in the nearby ruins.',
      session: 1,
      tags: ['introduction', 'waterdeep'],
      npcIds: ['1'],
      locationIds: ['1'],
      characterIds: ['1', '2'],
      questIds: ['1'],
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
      npcIds: [],
      locationIds: ['2'],
      characterIds: ['1', '2'],
      questIds: ['1'],
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
      description: 'The **City of Splendors**, a bustling metropolis on the *Sword Coast*.\n\n## Notable Features\n- Major trading hub\n- Home to many powerful guilds\n- Population of over 1 million\n\n> A city where fortunes are made and lost daily.',
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
      description: '**Mysterious ruins** beneath Waterdeep, origin *unknown*.\n\n### What We Know\n1. Built by an ancient civilization\n2. Contains dangerous creatures\n3. Holds valuable artifacts\n\nBeware of **goblins** and other threats!',
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

  // Seed Users (username: admin, password: admin)
  await db.insert(User).values([
    {
      id: '1',
      username: 'admin',
      passwordHash: await hashPassword('admin'),
      role: 'admin',
      createdAt: new Date(),
    },
    {
      id: '2',
      username: 'player1',
      passwordHash: await hashPassword('player1'),
      role: 'player',
      firstName: 'Alice',
      createdAt: new Date(),
    },
    {
      id: '3',
      username: 'dm',
      passwordHash: await hashPassword('dm123'),
      role: 'dungeonmaster',
      firstName: 'Bob',
      createdAt: new Date(),
    }
  ]);

  // Seed Campaign Progress - Level 5 at 50% progress to level 6
  await db.insert(CampaignProgress).values([
    {
      id: '1',
      currentLevel: 5,
      progressPercent: 50, // 50% progress to next level
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ]);

  console.log('Database seeded successfully!');
}

await seed();
