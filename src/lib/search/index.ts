// Global search: ranking and snippets. Pure, used by /api/search and by the palette (page list).
// Records come from src/lib/search/sources.ts (server) and commands.ts (pages).

export type Role = 'admin' | 'dungeonmaster' | 'player';
export type Viewer = Role | null; // null = logged out

export type Group =
  | 'pages' | 'npcs' | 'locations' | 'quests' | 'characters' | 'factions'
  | 'diary' | 'timeline' | 'library' | 'calendar' | 'bestiary';

export const GROUP_ORDER: Group[] = [
  'pages', 'npcs', 'locations', 'quests', 'characters', 'factions', 'diary', 'timeline', 'library', 'calendar', 'bestiary',
];

export const GROUP_LABELS: Record<Group, string> = {
  pages: 'Pages & tools',
  npcs: 'NPCs',
  locations: 'Locations',
  quests: 'Quests',
  characters: 'Characters',
  factions: 'Factions',
  diary: 'Diary',
  timeline: 'Timeline',
  library: 'Library',
  calendar: 'Calendar',
  bestiary: 'Bestiary',
};

export interface SearchRecord {
  group: Group;
  id: string;
  title: string;
  subtitle?: string;
  body?: string; // plain text (see plainText)
  href: string;
  access: 'public' | 'user' | 'dm' | 'admin';
}

export interface SearchResult {
  group: Group;
  id: string;
  title: string;
  subtitle?: string;
  snippet?: string; // HTML: escaped text with <mark> around the matches
  href: string;
  score: number;
}

export interface SearchGroup {
  group: Group;
  label: string;
  results: SearchResult[];
}

export const MIN_QUERY = 2;
const PER_GROUP = 8;
const TOTAL = 40;

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function canSee(access: SearchRecord['access'], viewer: Viewer): boolean {
  switch (access) {
    case 'public': return true;
    case 'user': return viewer !== null;
    case 'dm': return viewer === 'dungeonmaster' || viewer === 'admin';
    case 'admin': return viewer === 'admin';
  }
}

/** Markdown / HTML → plain text for matching and snippets. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_>`~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The normalized text plus, for each of its characters, where it starts in the original. */
function normalizeWithMap(text: string): { norm: string; at: number[] } {
  let norm = '';
  const at: number[] = [];
  let offset = 0;
  for (const ch of text) {
    const n = normalize(ch);
    for (let i = 0; i < n.length; i++) at.push(offset);
    norm += n;
    offset += ch.length;
  }
  return { norm, at };
}

/** ~width characters of body around the first match, escaped, matches wrapped in <mark>. */
export function snippet(body: string, terms: string[], width = 120): string | undefined {
  if (!body) return undefined;
  const { norm, at } = normalizeWithMap(body);
  const origIndex = (i: number) => (i < at.length ? at[i] : body.length);

  const first = Math.min(...terms.map((t) => norm.indexOf(t)).filter((i) => i >= 0));
  let start = Number.isFinite(first) ? Math.max(0, origIndex(first) - Math.floor(width / 3)) : 0;
  if (start > 0) {
    const space = body.indexOf(' ', start);
    if (space >= 0 && space < start + 15) start = space + 1;
  }
  let end = Math.min(body.length, start + width);
  if (end < body.length) {
    const space = body.lastIndexOf(' ', end);
    if (space > start + width - 20) end = space;
  }

  // Match ranges in original positions, inside the window, not overlapping
  const ranges: [number, number][] = [];
  for (const t of terms) {
    for (let i = norm.indexOf(t); i >= 0; i = norm.indexOf(t, i + t.length)) {
      const a = origIndex(i);
      const b = origIndex(i + t.length);
      if (a >= start && b <= end) ranges.push([a, b]);
    }
  }
  ranges.sort((x, y) => x[0] - y[0]);
  let html = start > 0 ? '…' : '';
  let pos = start;
  for (const [a, b] of ranges) {
    if (a < pos) continue;
    html += escapeHtml(body.slice(pos, a)) + '<mark>' + escapeHtml(body.slice(a, b)) + '</mark>';
    pos = b;
  }
  html += escapeHtml(body.slice(pos, end)) + (end < body.length ? '…' : '');
  return html;
}

function score(title: string, q: string, terms: string[]): number {
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  const words = title.split(/[\s\-–—,.:;'’()]+/).filter(Boolean);
  if (words.some((w) => terms.some((t) => w.startsWith(t)))) return 60;
  if (terms.some((t) => title.includes(t))) return 40;
  return 10;
}

export function search(query: string, records: SearchRecord[], viewer: Viewer): SearchGroup[] {
  const q = normalize(query.trim()).replace(/\s+/g, ' ');
  if (q.length < MIN_QUERY) return [];
  const terms = q.split(' ');

  const results: SearchResult[] = [];
  for (const r of records) {
    if (!canSee(r.access, viewer)) continue;
    const title = normalize(r.title);
    const body = normalize(r.body ?? '');
    const hay = `${title} ${normalize(r.subtitle ?? '')} ${body}`;
    if (!terms.every((t) => hay.includes(t))) continue;
    results.push({
      group: r.group,
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      snippet: r.body && terms.some((t) => body.includes(t)) ? snippet(r.body, terms) : undefined,
      href: r.href,
      score: score(title, q, terms),
    });
  }
  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  let left = TOTAL;
  const groups: SearchGroup[] = [];
  for (const group of GROUP_ORDER) {
    if (left <= 0) break;
    const list = results.filter((r) => r.group === group).slice(0, Math.min(PER_GROUP, left));
    if (list.length === 0) continue;
    left -= list.length;
    groups.push({ group, label: GROUP_LABELS[group], results: list });
  }
  return groups;
}
