import type { APIRoute } from 'astro';
import { db, Playlist, PlaylistTrack, eq } from '@/db';
import { canView, canEdit } from '../../../../../lib/music/access';
import { json, getViewer, loadPlaylist, deleteMusicFile, cleanName, isVisibility } from '../../../../../lib/music/server';

const notFound = () => json({ error: 'Playlist not found' }, 404);

// GET - One playlist with its tracks
export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const viewer = await getViewer(cookies);
    if (!viewer) return json({ error: 'Not logged in' }, 401);
    const playlist = await loadPlaylist(params.id!);
    if (!playlist || !canView(playlist, viewer)) return notFound();
    return json({ ...playlist, canEdit: canEdit(playlist, viewer) });
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return json({ error: 'Failed to fetch playlist' }, 500);
  }
};

// PATCH - Rename or change visibility
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    const viewer = await getViewer(cookies);
    if (!viewer) return json({ error: 'Not logged in' }, 401);
    const playlist = await loadPlaylist(params.id!);
    if (!playlist || !canView(playlist, viewer)) return notFound();
    if (!canEdit(playlist, viewer)) return json({ error: 'You cannot change this playlist' }, 403);
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const changes: { name?: string; visibility?: string } = {};
    if (body?.name !== undefined) {
      const name = cleanName(body.name);
      if (!name) return json({ error: 'Name must be 1-80 characters' }, 400);
      changes.name = name;
    }
    if (body?.visibility !== undefined) {
      if (!isVisibility(body.visibility)) return json({ error: 'Visibility must be public or private' }, 400);
      if (playlist.isSiteDefault && body.visibility === 'private') return json({ error: 'The site playlist must stay public' }, 400);
      changes.visibility = body.visibility;
    }
    if (!Object.keys(changes).length) return json({ error: 'Nothing to change' }, 400);
    const [updated] = await db.update(Playlist).set({ ...changes, updatedAt: new Date() }).where(eq(Playlist.id, playlist.id)).returning();
    return json(updated);
  } catch (error) {
    console.error('Error updating playlist:', error);
    return json({ error: 'Failed to update playlist' }, 500);
  }
};

// DELETE - Remove a playlist, its tracks and their uploaded files
export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const viewer = await getViewer(cookies);
    if (!viewer) return json({ error: 'Not logged in' }, 401);
    const playlist = await loadPlaylist(params.id!);
    if (!playlist || !canView(playlist, viewer)) return notFound();
    if (!canEdit(playlist, viewer)) return json({ error: 'You cannot delete this playlist' }, 403);
    if (playlist.isSiteDefault) return json({ error: 'The site playlist cannot be deleted. Choose another site playlist first.' }, 409);
    for (const t of playlist.tracks) if (t.kind === 'file') await deleteMusicFile(t.ref);
    await db.delete(PlaylistTrack).where(eq(PlaylistTrack.playlistId, playlist.id));
    await db.delete(Playlist).where(eq(Playlist.id, playlist.id));
    return json({ ok: true });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    return json({ error: 'Failed to delete playlist' }, 500);
  }
};
