import { db, DiaryEntry, Quest, Character, NPC, Location, User, CampaignProgress } from 'astro:db';
import { hashPassword } from '../src/lib/auth';

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
    },
    {
      id: '3',
      date: '2025-10-29',
      title: 'The Merchant\'s Request',
      content: 'Met with a merchant at his shop who had information about the amulet. He directed us to seek the wisdom of the druids in the forest.',
      session: 3,
      tags: ['investigation', 'shopping'],
      npcIds: ['2'],
      locationIds: ['3'],
      characterIds: ['1', '2'],
      questIds: ['1'],
      createdAt: new Date('2025-10-29'),
      updatedAt: new Date('2025-10-29'),
    },
    {
      id: '4',
      date: '2025-11-05',
      title: 'Journey to the Forest',
      content: 'Traveled through the wilderness to reach the ancient druid grove. The journey was peaceful but we sensed we were being watched.',
      session: 4,
      tags: ['travel', 'nature'],
      npcIds: [],
      locationIds: ['4'],
      characterIds: ['1', '2'],
      questIds: ['1'],
      createdAt: new Date('2025-11-05'),
      updatedAt: new Date('2025-11-05'),
    },
    {
      id: '5',
      date: '2025-11-12',
      title: 'Return to the City',
      content: 'Armed with knowledge from the druids, we returned to Neverwinter to prepare for the final confrontation.',
      session: 5,
      tags: ['preparation', 'city'],
      npcIds: [],
      locationIds: ['5'],
      characterIds: ['1', '2'],
      questIds: ['1'],
      createdAt: new Date('2025-11-12'),
      updatedAt: new Date('2025-11-12'),
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

  // Seed Locations - demonstrating all location types connecting via hero path
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
      visibleOnMap: true,
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
      visibleOnMap: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '3',
      name: 'Curious Merchant Shop',
      type: 'building',
      description: 'A mysterious shop filled with rare and magical items',
      region: 'Waterdeep Market District',
      visited: true,
      notes: 'The merchant had valuable information about the amulet',
      mapX: 32,
      mapY: 38,
      visibleOnMap: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '4',
      name: 'Druid Grove',
      type: 'wilderness',
      description: 'An ancient grove deep in the forest, protected by druids',
      region: 'Neverwinter Wood',
      visited: true,
      notes: 'The druids provided crucial knowledge about the amulet',
      mapX: 45,
      mapY: 30,
      visibleOnMap: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '5',
      name: 'Neverwinter',
      type: 'city',
      description: 'The Jewel of the North, a vibrant city known for its craftsmen',
      region: 'Sword Coast North',
      visited: true,
      notes: 'Returned here to prepare for the final battle',
      mapX: 50,
      mapY: 25,
      visibleOnMap: true,
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
