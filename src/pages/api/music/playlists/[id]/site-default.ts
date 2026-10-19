import type { APIRoute } from 'astro';
import { db, Playlist, eq } from '@/db';
import { canSetSiteDefault } from '../../../../../lib/music/access';
import { json, getViewer, loadPlaylist } from '../../../../../lib/music/server';

// POST - Make this playlist the site playlist (admin only); it becomes public
export const POST: APIRoute = async ({ params, cookies }) => {
  try {
    const viewer = await getViewer(cookies);
    if (!viewer) return json({ error: 'Not logged in' }, 401);
    if (!canSetSiteDefault(viewer)) return json({ error: 'Only an admin can choose the site playlist' }, 403);
    const playlist = await loadPlaylist(params.id!);
    if (!playlist) return json({ error: 'Playlist not found' }, 404);
    const updated = await db.transaction(async (tx) => {
      await tx.update(Playlist).set({ isSiteDefault: false }).where(eq(Playlist.isSiteDefault, true));
      const [row] = await tx.update(Playlist).set({ isSiteDefault: true, visibility: 'public', updatedAt: new Date() }).where(eq(Playlist.id, playlist.id)).returning();
      return row;
    });
    return json(updated);
  } catch (error) {
    console.error('Error setting site playlist:', error);
    return json({ error: 'Failed to set site playlist' }, 500);
  }
};
