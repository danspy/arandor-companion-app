import type { APIRoute } from 'astro';
import { db, PlaylistTrack, eq } from '@/db';
import { canView, canEdit } from '../../../../../lib/music/access';
import { fetchYouTubeTitle } from '../../../../../lib/music/youtube';
import { json, getViewer, loadPlaylist } from '../../../../../lib/music/server';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_VIDEOS = 200;
const MAX_RAW_IDS = 1000; // raw list length (duplicates included) accepted before the ids are checked
const LOOKUPS = 6; // concurrent oEmbed title lookups

/** Runs fn over items with at most `limit` running at once; results keep the input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// POST - Add YouTube videos (read from a YouTube playlist in the browser) as separate tracks.
// Body: { videoIds: string[], titles?: Record<id, title> } (titles skip the oEmbed lookup).
export const POST: APIRoute = async ({ params, request, cookies }) => {
  try {
    const viewer = await getViewer(cookies);
    if (!viewer) return json({ error: 'Not logged in' }, 401);
    const playlist = await loadPlaylist(params.id!);
    if (!playlist || !canView(playlist, viewer)) return json({ error: 'Playlist not found' }, 404);
    if (!canEdit(playlist, viewer)) return json({ error: 'You cannot change this playlist' }, 403);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const raw = body?.videoIds;
    // Checked before the id scan, so a huge list costs nothing
    if (Array.isArray(raw) && raw.length > MAX_RAW_IDS) return json({ error: `At most ${MAX_VIDEOS} videos per import` }, 400);
    if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string' || !VIDEO_ID.test(v))) {
      return json({ error: 'videoIds must be a list of YouTube video ids' }, 400);
    }
    const ids = [...new Set<string>(raw)];
    if (!ids.length) return json({ error: 'No videos to import' }, 400);
    if (ids.length > MAX_VIDEOS) return json({ error: `At most ${MAX_VIDEOS} videos per import` }, 400);
    const given = body.titles && typeof body.titles === 'object' ? body.titles : {};

    const titles = await mapLimit(ids, LOOKUPS, async (id) => {
      const t = typeof given[id] === 'string' ? given[id].trim() : '';
      return (t || (await fetchYouTubeTitle(`https://www.youtube.com/watch?v=${id}`)) || `https://youtu.be/${id}`).slice(0, 200);
    });

    // Positions are read inside the transaction: the title lookups above can take seconds
    const tracks = await db.transaction(async (tx) => {
      const existing = await tx.select({ position: PlaylistTrack.position }).from(PlaylistTrack).where(eq(PlaylistTrack.playlistId, playlist.id));
      const start = existing.reduce((m, t) => Math.max(m, t.position), -1) + 1;
      return tx.insert(PlaylistTrack).values(ids.map((ref, i) => ({
        id: crypto.randomUUID(), playlistId: playlist.id, position: start + i,
        kind: 'youtube_video' as const, title: titles[i], ref,
      }))).returning();
    });
    tracks.sort((a, b) => a.position - b.position);
    return json({ added: tracks.length, tracks }, 201);
  } catch (error) {
    console.error('Error importing tracks:', error);
    return json({ error: 'Failed to import the videos' }, 500);
  }
};
