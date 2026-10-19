import type { APIRoute } from 'astro';
import { db, PlaylistTrack, eq } from '@/db';
import { canView, canEdit } from '../../../../../lib/music/access';
import { json, getViewer, loadPlaylist } from '../../../../../lib/music/server';

// PUT - Set the track order; trackIds must be exactly the playlist's tracks
export const PUT: APIRoute = async ({ params, request, cookies }) => {
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
    const ids = body?.trackIds;
    if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string')) return json({ error: 'trackIds must be a list of ids' }, 400);
    const known = new Set(playlist.tracks.map((t) => t.id));
    if (new Set(ids).size !== ids.length || ids.length !== known.size || ids.some((i) => !known.has(i))) {
      return json({ error: 'trackIds must list every track of the playlist exactly once' }, 400);
    }
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) await tx.update(PlaylistTrack).set({ position: i }).where(eq(PlaylistTrack.id, ids[i]));
    });
    return json({ ok: true });
  } catch (error) {
    console.error('Error ordering tracks:', error);
    return json({ error: 'Failed to reorder tracks' }, 500);
  }
};
