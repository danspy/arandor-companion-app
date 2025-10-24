import type { DiaryEntry, Quest, Character, NPC, Location } from '../types';

export const diaryEntries: DiaryEntry[] = [
  {
    id: '1',
    date: '2025-10-15',
    title: 'The Journey Begins',
    content: 'Our party assembled at the Prancing Pony tavern in Waterdeep. We were tasked by Lord Neverember to investigate strange occurrences in the nearby ruins.',
    session: 1,
    tags: ['introduction', 'waterdeep']
  },
  {
    id: '2',
    date: '2025-10-22',
    title: 'Into the Ruins',
    content: 'Descended into the ancient ruins beneath the city. Encountered goblins and found a mysterious amulet with strange runes.',
    session: 2,
    tags: ['combat', 'discovery', 'ruins']
  }
];

export const quests: Quest[] = [
  {
    id: '1',
    title: 'Investigate the Ruins',
    description: 'Explore the ancient ruins beneath Waterdeep and report findings to Lord Neverember',
    status: 'active',
    priority: 'high'
  },
  {
    id: '2',
    title: 'Find the Missing Merchant',
    description: 'Locate Grimwald, a merchant who disappeared near the docks',
    status: 'active',
    priority: 'medium'
  }
];

export const characters: Character[] = [
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
    }
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
    }
  }
];

export const npcs: NPC[] = [
  {
    id: '1',
    name: 'Lord Neverember',
    race: 'Human',
    occupation: 'Noble',
    location: 'Waterdeep',
    description: 'Ruler of Waterdeep, wealthy and influential',
    relationship: 'ally',
    notes: 'Gave us the quest to investigate the ruins'
  },
  {
    id: '2',
    name: 'Grimwald the Merchant',
    race: 'Halfling',
    occupation: 'Merchant',
    location: 'Unknown',
    description: 'Missing merchant, last seen near the docks',
    relationship: 'neutral',
    notes: 'Subject of current quest'
  }
];

export const locations: Location[] = [
  {
    id: '1',
    name: 'Waterdeep',
    type: 'city',
    description: 'The City of Splendors, a bustling metropolis on the Sword Coast',
    region: 'Sword Coast',
    visited: true,
    notes: 'Our current base of operations'
  },
  {
    id: '2',
    name: 'Ancient Ruins',
    type: 'dungeon',
    description: 'Mysterious ruins beneath Waterdeep, origin unknown',
    region: 'Waterdeep Undermountain',
    visited: true,
    notes: 'Found goblin presence and a mysterious amulet'
  }
];
