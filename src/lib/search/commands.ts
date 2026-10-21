// Pages offered by global search, with the access each page's own guard allows.
// Keep in step with the redirects at the top of each page.

import { formatRoll, parseRoll } from '../dice-notation';
import type { SearchRecord } from './index';

const page = (href: string, title: string, access: SearchRecord['access'], keywords = ''): SearchRecord => ({
  group: 'pages', id: href, title, body: keywords, href, access,
});

export const COMMANDS: SearchRecord[] = [
  page('/', 'Home', 'public', 'dashboard start factions campaign progress'),
  page('/diary', 'Diary', 'public', 'sessions journal recap'),
  page('/library', 'Library', 'public', 'lore'),
  page('/library/docs', 'Library documents', 'public', 'docs lore handouts'),
  page('/library/timeline', 'Timeline', 'public', 'chronicle history events'),
  page('/characters', 'Characters', 'public', 'party players adventurers'),
  page('/npcs', 'NPCs', 'public', 'people'),
  page('/locations', 'Locations', 'public', 'places'),
  page('/map', 'Map', 'public', 'world'),
  page('/quests', 'Quests', 'public', 'tasks missions'),
  page('/changelog', 'Changelog', 'public', 'whats new updates'),
  page('/tools/dice-roller', 'Dice roller', 'public', 'roll dice'),
  page('/tools', 'Tools', 'user'),
  page('/calendar', 'Calendar', 'user', 'sessions dates schedule'),
  page('/profile', 'Profile', 'user', 'account password settings'),
  page('/tools/music', 'Music', 'user', 'playlists youtube'),
  page('/tools/initiative', 'Initiative tracker', 'user', 'combat fight turns'),
  page('/tools/dm-screen', 'DM screen', 'dm', 'dungeon master display spotlight'),
  page('/tools/bestiary', 'Bestiary', 'dm', 'monsters creatures stat blocks'),
  page('/tools/bestiary/new', 'New creature', 'dm', 'stat block homebrew paste'),
  page('/tools/bestiary/generate', 'NPC generator', 'dm', 'stat block generate'),
  page('/users', 'Users', 'admin', 'accounts roles'),
];

/** "2d6+3" → a "Roll 2d6+3" action; anything that is not a dice roll → null. */
export function diceAction(query: string): { label: string; notation: string } | null {
  const text = query.trim();
  if (!/\d*[dw]\d/i.test(text)) return null;
  const parsed = parseRoll(text);
  if (!parsed.ok || parsed.roll.dice.length === 0) return null;
  const notation = formatRoll(parsed.roll);
  return { label: `Roll ${notation}`, notation };
}
