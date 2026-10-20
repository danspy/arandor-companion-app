import type { APIRoute } from 'astro';
import { db, Character, eq, sql } from '@/db';
import { syncCharacterFromDnDBeyond } from '../../../lib/character-sync';

// A character is refreshed from D&D Beyond at most this often by visits
const MIN_INTERVAL_MS = 15 * 60 * 1000;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Automatic sync from D&D Beyond, triggered by visits to the dashboard and the Characters list.
 * Full data (HP, ability scores, sheet …), D&D Beyond is the truth; at most every 15 minutes per
 * character (also after a failed attempt). Works for every visitor and returns no character data,
 * only whether something changed.
 *
 * POST /api/characters/auto-sync
 * Body: { characterId: string }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const { characterId } = await request.json();
    if (!characterId || typeof characterId !== 'string') return json({ error: 'Character ID is required' }, 400);

    const character = await db.select().from(Character).where(eq(Character.id, characterId)).get();
    if (!character) return json({ error: 'Character not found' }, 404);
    if (!character.dndbeyondUrl) return json({ success: false, message: 'Character does not have a D&D Beyond URL' });

    // Claim the slot before asking D&D Beyond: parallel requests can't all get through, and a
    // failing sheet (made private, D&D Beyond down) is not asked again on every visit either.
    const cutoff = new Date(Date.now() - MIN_INTERVAL_MS).toISOString();
    const claimed = await db.update(Character)
      .set({ lastSyncedAt: new Date() })
      .where(sql`${Character.id} = ${characterId} AND (${Character.lastSyncedAt} IS NULL OR ${Character.lastSyncedAt} < ${cutoff})`)
      .returning({ id: Character.id });
    if (!claimed.length) {
      return json({ success: false, message: 'Character was synced recently', lastSyncedAt: character.lastSyncedAt });
    }

    const { character: updated, changed } = await syncCharacterFromDnDBeyond(character);
    return json({ success: true, updated: changed, lastSyncedAt: updated.lastSyncedAt });
  } catch (error) {
    console.error('Auto-sync error:', error);
    return json({ success: false, message: 'Auto-sync failed', error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
};
