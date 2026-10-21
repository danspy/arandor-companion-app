import type { APIRoute } from 'astro';
import { db, Character, InitiativeTracker, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { syncCharacterFromDnDBeyond } from '../../../lib/character-sync';

// How many D&D Beyond sheets are fetched at the same time
const CONCURRENCY = 3;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Result = { id: string; name: string; ok: boolean; error?: string };

/**
 * "Sync all" on the DM screen: full sync from D&D Beyond of every active party character that
 * has a link, right now (no 15-minute wait). One failing sheet doesn't stop the others. Their
 * initiative tracker entries (linked, or with the same name, like /api/initiative/sync-hp) get
 * the new HP too.
 *
 * POST /api/characters/sync-all
 * → { synced, failed: [{ id, name, error }], results: [{ id, name, ok, error? }], syncedAt }
 */
export const POST: APIRoute = async ({ cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  const party = (await db.select().from(Character)).filter((c) => c.isActive && c.dndbeyondUrl);
  const tracker = await db.select().from(InitiativeTracker);
  const results: Result[] = [];
  const queue = [...party];

  async function worker() {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        const { character } = await syncCharacterFromDnDBeyond(c);
        for (const entry of tracker.filter((e) => e.characterId ? e.characterId === c.id : e.name === c.name)) {
          await db.update(InitiativeTracker).set({
            hp: character.hp,
            maxHp: character.maxHp,
            tempHp: character.tempHp ?? 0,
            // Back up: the death saves are over
            ...(character.hp ? { deathSaveSuccesses: 0, deathSaveFailures: 0, isStable: false } : {}),
            updatedAt: new Date(),
          }).where(eq(InitiativeTracker.id, entry.id));
        }
        results.push({ id: c.id, name: character.name, ok: true });
      } catch (error) {
        console.error(`Sync all: ${c.name} failed:`, error);
        results.push({ id: c.id, name: c.name, ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, party.length) }, worker));

  results.sort((a, b) => a.name.localeCompare(b.name));
  const failed = results.filter((r) => !r.ok).map(({ id, name, error }) => ({ id, name, error }));
  return json({ synced: results.length - failed.length, failed, results, syncedAt: new Date() });
};
