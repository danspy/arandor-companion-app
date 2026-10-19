import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { db, CampaignProgress, DMScreenState, Location, NPC, eq, inArray } from '@/db';
import { currentEntry, getCombatState, getEntries, healthStatus } from '../../../lib/combat';

const DM_SCREEN_STATE_ID = 'current-dm-screen';

// GET - Everything the player display (/display) shows, in one response.
// Public on purpose (the display runs without a login), so it only contains what players may
// see: no exact HP, AC or notes. Answers 304 when nothing changed since the caller's ETag, so
// the display can poll every two seconds for a few hundred bytes.
export const GET: APIRoute = async ({ request }) => {
  try {
    const screen = await db.select().from(DMScreenState).where(eq(DMScreenState.id, DM_SCREEN_STATE_ID)).get();
    const campaign = await db.select({ heroImageUrl: CampaignProgress.heroImageUrl }).from(CampaignProgress).limit(1).get();

    const location = screen?.currentLocationId
      ? await db.select({ name: Location.name, type: Location.type, region: Location.region, imageUrl: Location.imageUrl })
          .from(Location).where(eq(Location.id, screen.currentLocationId)).get()
      : undefined;

    const npcIds = (screen?.spotlightNpcIds ?? []) as string[];
    const npcRows = npcIds.length
      ? await db.select({ id: NPC.id, name: NPC.name, race: NPC.race, occupation: NPC.occupation, avatarUrl: NPC.avatarUrl })
          .from(NPC).where(inArray(NPC.id, npcIds))
      : [];
    // Keep the order the DM added them in
    const npcs = npcIds.flatMap((id) => {
      const n = npcRows.find((row) => row.id === id);
      return n ? [{ id: n.id, name: n.name, subtitle: n.occupation || n.race, avatarUrl: n.avatarUrl }] : [];
    });

    let initiative = null;
    if (screen?.showInitiativeTracker) {
      const [entries, combat] = await Promise.all([getEntries(), getCombatState()]);
      const current = currentEntry(entries, combat);
      initiative = {
        status: combat.status,
        round: combat.currentRound,
        entries: entries.filter((e) => e.isActive).map((e) => ({
          id: e.id,
          name: e.name,
          initiative: e.initiative,
          type: e.type,
          health: healthStatus(e),
          isStable: e.type === 'character' && e.hp === 0 ? e.isStable : false,
          isCurrent: e.id === current?.id,
        })),
      };
    }

    const placeholder = screen?.placeholderImageUrl ?? null;
    const payload = {
      screenVisible: screen?.screenVisible ?? true,
      // Older wallpapers were saved inline as data: URLs (megabytes); serve those separately
      // so they are downloaded once and cached, not with every poll.
      wallpaperUrl: placeholder?.startsWith('data:')
        ? `/api/display/wallpaper?v=${crypto.createHash('sha1').update(placeholder).digest('hex').slice(0, 12)}`
        : placeholder,
      backdropUrl: campaign?.heroImageUrl ?? null,
      location: location ?? null,
      npcs,
      initiative,
      timer: screen?.showTimer
        ? {
            status: screen.timerStatus,
            duration: screen.timerDuration,
            startedAt: screen.timerStartedAt,
            pausedAt: screen.timerPausedAt,
          }
        : null,
    };

    const body = JSON.stringify(payload);
    const etag = `"${crypto.createHash('sha1').update(body).digest('base64url')}"`;
    // Server clock, so the display's countdown doesn't depend on its own clock being right
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ETag: etag, 'X-Server-Time': String(Date.now()) };
    if (request.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(body, { status: 200, headers });
  } catch (error) {
    console.error('Error building player display state:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
