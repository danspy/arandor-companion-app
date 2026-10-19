import type { APIRoute } from 'astro';
import { db, PlaylistTrack, eq } from '@/db';
import { canView, canEdit } from '../../../../lib/music/access';
import { json, getViewer, loadPlaylist, deleteMusicFile } from '../../../../lib/music/server';

// Finds the track and its playlist, applying the 401 / 404 / 403 order. Returns a Response on failure.
async function resolve(id: string, cookies: Parameters<typeof getViewer>[0]) {
  const viewer = await getViewer(cookies);
  if (!viewer) return { error: json({ error: 'Not logged in' }, 401) };
  const [track] = await db.select().from(PlaylistTrack).where(eq(PlaylistTrack.id, id));
  const playlist = track ? await loadPlaylist(track.playlistId) : null;
  if (!track || !playlist || !canView(playlist, viewer)) return { error: json({ error: 'Track not found' }, 404) };
  if (!canEdit(playlist, viewer)) return { error: json({ error: 'You cannot change this playlist' }, 403) };
  return { track };
}

// PATCH - Rename a track
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    const r = await resolve(params.id!, cookies);
    if (r.error) return r.error;
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (title.length < 1 || title.length > 200) return json({ error: 'Title must be 1-200 characters' }, 400);
    const [updated] = await db.update(PlaylistTrack).set({ title }).where(eq(PlaylistTrack.id, r.track!.id)).returning();
    return json(updated);
  } catch (error) {
    console.error('Error renaming track:', error);
    return json({ error: 'Failed to rename track' }, 500);
  }
};

// DELETE - Remove a track (row first, then its uploaded file)
export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const r = await resolve(params.id!, cookies);
    if (r.error) return r.error;
    const track = r.track!;
    await db.delete(PlaylistTrack).where(eq(PlaylistTrack.id, track.id));
    if (track.kind === 'file') await deleteMusicFile(track.ref).catch((e) => console.error('Could not delete music file:', e));
    return json({ ok: true });
  } catch (error) {
    console.error('Error deleting track:', error);
    return json({ error: 'Failed to delete track' }, 500);
  }
};
