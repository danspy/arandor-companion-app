// Everything global search can find, as SearchRecords. Server side only.
// Reads only the columns listed in docs/superpowers/specs/2026-10-21-global-search-design.md;
// private notes (CharacterNote, DiaryNote, NPC/Location notes) are never read here.

import { db, NPC, Location, Quest, Character, Faction, DiaryEntry, TimelineEntry, LibraryEntry, Event, Creature, eq } from '@/db';
import { srdCreatures } from '../srd';
import { canSee, plainText, type SearchRecord, type Viewer } from './index';

const join = (...parts: (string | number | null | undefined)[]) => parts.filter((p) => p !== null && p !== undefined && p !== '').join(' · ');
const text = (...parts: (string | null | undefined)[]) => plainText(parts.filter(Boolean).join(' \n '));

export async function loadRecords(viewer: Viewer): Promise<SearchRecord[]> {
  const records: SearchRecord[] = [];

  const [npcs, locations, quests, characters, factions, diary, timeline, library] = await Promise.all([
    db.select({ id: NPC.id, name: NPC.name, race: NPC.race, occupation: NPC.occupation, location: NPC.location, description: NPC.description }).from(NPC),
    db.select({ id: Location.id, name: Location.name, type: Location.type, region: Location.region, description: Location.description }).from(Location),
    db.select({ id: Quest.id, title: Quest.title, status: Quest.status, description: Quest.description }).from(Quest),
    db.select({ id: Character.id, name: Character.name, race: Character.race, class: Character.class, level: Character.level, player: Character.player, isActive: Character.isActive }).from(Character),
    db.select({ id: Faction.id, name: Faction.name, status: Faction.status }).from(Faction),
    db.select({ id: DiaryEntry.id, title: DiaryEntry.title, session: DiaryEntry.session, summary: DiaryEntry.summary, content: DiaryEntry.content, tags: DiaryEntry.tags }).from(DiaryEntry),
    db.select({ id: TimelineEntry.id, year: TimelineEntry.year, headline: TimelineEntry.headline, shortDescription: TimelineEntry.shortDescription, fullDescription: TimelineEntry.fullDescription }).from(TimelineEntry).where(eq(TimelineEntry.entryType, 'event')),
    db.select({ id: LibraryEntry.id, title: LibraryEntry.title, content: LibraryEntry.content, tags: LibraryEntry.tags }).from(LibraryEntry),
  ]);

  for (const n of npcs) {
    records.push({ group: 'npcs', id: n.id, title: n.name, subtitle: join(n.race, n.occupation), body: text(n.location, n.description), href: `/npcs/${n.id}`, access: 'public' });
  }
  for (const l of locations) {
    records.push({ group: 'locations', id: l.id, title: l.name, subtitle: join(l.type, l.region), body: text(l.description), href: `/locations/${l.id}`, access: 'public' });
  }
  for (const q of quests) {
    records.push({ group: 'quests', id: q.id, title: q.title, subtitle: q.status, body: text(q.description), href: `/quests/${q.id}`, access: 'public' });
  }
  for (const c of characters) {
    records.push({
      group: 'characters', id: c.id, title: c.name,
      subtitle: join(`${c.race} ${c.class} ${c.level}`, c.player, c.isActive === false ? 'inactive' : null),
      href: `/characters/${c.id}`, access: 'public',
    });
  }
  for (const f of factions) {
    records.push({ group: 'factions', id: f.id, title: f.name, subtitle: f.status, href: '/#factions', access: 'public' });
  }
  for (const d of diary) {
    records.push({ group: 'diary', id: d.id, title: d.title, subtitle: `Session ${d.session}`, body: text(d.summary, d.content, (d.tags ?? []).join(' ')), href: `/diary/${d.id}`, access: 'public' });
  }
  for (const t of timeline) {
    if (!t.headline) continue;
    records.push({ group: 'timeline', id: t.id, title: t.headline, subtitle: `Year ${t.year}`, body: text(t.shortDescription, t.fullDescription), href: `/library/timeline/${t.id}`, access: 'public' });
  }
  for (const e of library) {
    records.push({ group: 'library', id: e.id, title: e.title, body: text(e.content, (e.tags ?? []).join(' ')), href: `/library/${e.id}`, access: 'public' });
  }

  if (canSee('user', viewer)) {
    const events = await db.select({ id: Event.id, title: Event.title, description: Event.description, date: Event.date, time: Event.time }).from(Event);
    for (const e of events) {
      records.push({ group: 'calendar', id: e.id, title: e.title, subtitle: join(e.date, e.time), body: text(e.description), href: '/calendar', access: 'user' });
    }
  }

  if (canSee('dm', viewer)) {
    const own = await db.select({ id: Creature.id, name: Creature.name, cr: Creature.cr, typeLine: Creature.typeLine }).from(Creature);
    for (const c of own) {
      records.push({ group: 'bestiary', id: c.id, title: c.name, subtitle: join(c.cr ? `CR ${c.cr}` : null, c.typeLine), href: `/tools/bestiary/${c.id}`, access: 'dm' });
    }
    for (const c of srdCreatures()) {
      records.push({ group: 'bestiary', id: `srd:${c.key}`, title: c.name, subtitle: join(c.cr ? `CR ${c.cr}` : null, c.typeLine, 'SRD'), href: `/tools/bestiary/srd/${c.key}`, access: 'dm' });
    }
  }

  return records;
}
