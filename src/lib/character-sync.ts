// Pull a character from D&D Beyond into the database. D&D Beyond is the truth: name, level,
// HP, ability scores (also ones edited by hand in the app) and the character sheet are replaced.
// Used by the Sync button (/api/characters/sync) and the automatic sync (/api/characters/auto-sync).
import { db, Character, eq } from '@/db';
import { fetchDnDBeyondCharacter } from './dndbeyond';

type CharacterRow = typeof Character.$inferSelect;

// What the dashboard, the Characters list and the character page show from a sync
const VISIBLE_FIELDS = ['name', 'race', 'class', 'level', 'avatarUrl', 'hp', 'maxHp', 'tempHp', 'stats', 'sheet', 'background', 'alignment'] as const;

export async function syncCharacterFromDnDBeyond(character: CharacterRow): Promise<{ character: CharacterRow; changed: boolean }> {
  if (!character.dndbeyondUrl) throw new Error('Character does not have a D&D Beyond URL');
  const d = await fetchDnDBeyondCharacter(character.dndbeyondUrl);
  const now = new Date();
  await db.update(Character).set({
    name: d.name || character.name,
    race: d.race || character.race,
    class: d.class || character.class,
    level: d.level || character.level,
    avatarUrl: d.avatarUrl || character.avatarUrl,
    hp: d.hp ?? character.hp,
    maxHp: d.maxHp ?? character.maxHp,
    tempHp: d.tempHp ?? 0,
    stats: d.stats ?? character.stats,
    statsManuallyEdited: false,
    sheet: d.sheet ?? character.sheet,
    gender: d.gender || character.gender,
    alignment: d.alignment || character.alignment,
    background: d.background || character.background,
    age: d.age || character.age,
    height: d.height || character.height,
    weight: d.weight || character.weight,
    eyes: d.eyes || character.eyes,
    skin: d.skin || character.skin,
    hair: d.hair || character.hair,
    lastSyncedAt: now,
    updatedAt: now,
  }).where(eq(Character.id, character.id));
  const updated = (await db.select().from(Character).where(eq(Character.id, character.id)).get())!;
  const changed = VISIBLE_FIELDS.some((k) => JSON.stringify(updated[k]) !== JSON.stringify(character[k]));
  return { character: updated, changed };
}
