export interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  session: number;
  tags: string[];
  coverImageUrl?: string;
  npcIds: string[];
  locationIds: string[];
  characterIds: string[];
  questIds: string[];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'failed';
  priority: 'high' | 'medium' | 'low';
}

export interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  race: string;
  player: string;
  avatarUrl?: string;
  dndbeyondUrl?: string;
  stats?: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}

export interface NPC {
  id: string;
  name: string;
  race: string;
  occupation?: string;
  location?: string;
  description: string;
  relationship: 'ally' | 'neutral' | 'enemy';
  notes?: string;
}

export interface Location {
  id: string;
  name: string;
  type: 'city' | 'dungeon' | 'wilderness' | 'building' | 'other';
  description: string;
  region?: string;
  visited: boolean;
  notes?: string;
  mapX?: number;
  mapY?: number;
  visibleOnMap?: boolean;
}

export interface CampaignProgress {
  id: string;
  currentLevel: number;
  progressPercent: number; // 0-100 in steps of 10
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LibraryEntry {
  id: string;
  title: string;
  content: string; // Markdown content
  tags: string[];
  locationId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Faction {
  id: string;
  name: string;
  status: 'enemy' | 'suspicious' | 'neutral' | 'friendly' | 'respectful';
  progress: number; // 0-100 independent of status
  createdAt?: Date;
  updatedAt?: Date;
}
