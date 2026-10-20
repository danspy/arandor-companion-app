// The character page's campaign section: what the diary and the timeline already say about a
// character (src/components/character/CampaignSection.astro). Quests and NPCs come from the
// diary entries of the sessions the character was in.
import { byStory } from './timeline-layout';

interface DiaryLink { id: string; session: number; date: string; title: string; characterIds: unknown; questIds: unknown; npcIds: unknown }
interface QuestRow { id: string; title: string; status: string }
interface NpcRow { id: string; name: string; relationship: string; avatarUrl: string | null }
interface TimelineLink { id: string; entryType: string; year: number; month: number | null; sortOrder: number | null; headline: string | null; characterIds: unknown }

export interface CharacterCampaign {
  sessions: { id: string; session: number; date: string; title: string }[]; // newest first
  quests: QuestRow[]; // active first, then completed, then failed
  npcs: NpcRow[]; // by name
  timeline: { id: string; year: number; month: number | null; headline: string }[]; // story order
}

const ids = (value: unknown): string[] => (Array.isArray(value) ? value : []);
const STATUS_ORDER: Record<string, number> = { active: 0, completed: 1, failed: 2 };

export function characterCampaign(
  characterId: string,
  sources: { diary: DiaryLink[]; quests: QuestRow[]; npcs: NpcRow[]; timeline: TimelineLink[] },
): CharacterCampaign {
  const sessions = sources.diary.filter((d) => ids(d.characterIds).includes(characterId)).sort((a, b) => b.session - a.session);
  const questIds = new Set(sessions.flatMap((d) => ids(d.questIds)));
  const npcIds = new Set(sessions.flatMap((d) => ids(d.npcIds)));
  return {
    sessions: sessions.map(({ id, session, date, title }) => ({ id, session, date, title })),
    quests: sources.quests.filter((q) => questIds.has(q.id))
      .map(({ id, title, status }) => ({ id, title, status }))
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || a.title.localeCompare(b.title)),
    npcs: sources.npcs.filter((n) => npcIds.has(n.id))
      .map(({ id, name, relationship, avatarUrl }) => ({ id, name, relationship, avatarUrl }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    timeline: sources.timeline.filter((t) => t.entryType === 'event' && t.headline && ids(t.characterIds).includes(characterId))
      .sort(byStory)
      .map(({ id, year, month, headline }) => ({ id, year, month, headline: headline! })),
  };
}
