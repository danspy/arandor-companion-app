import type { APIRoute } from 'astro';
import { db, Playlist, PlaylistTrack } from '@/db';
import { canView, canEdit } from '../../../../lib/music/access';
import { json, getViewer, cleanName, isVisibility, ownerNames, type PlaylistSummary } from '../../../../lib/music/server';

// GET - Playlists the viewer may see: site first, then their own, then the rest by name
export const GET: APIRoute = async ({ cookies }) => {
  try {
    const viewer = await getViewer(cookies);
    if (!viewer) return json({ error: 'Not logged in' }, 401);
    const [rows, tracks, names] = await Promise.all([
      db.select().from(Playlist),
      db.select({ playlistId: PlaylistTrack.playlistId }).from(PlaylistTrack),
      ownerNames(),
    ]);
    const counts = new Map<string, number>();
    for (const t of tracks) counts.set(t.playlistId, (counts.get(t.playlistId) ?? 0) + 1);
    const rank = (p: { isSiteDefault: boolean; ownerId: string }) => (p.isSiteDefault ? 0 : p.ownerId === viewer.id ? 1 : 2);
    const list: PlaylistSummary[] = rows
      .filter((p) => canView(p, viewer))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .map((p) => ({
        id: p.id, name: p.name, visibility: p.visibility, isSiteDefault: p.isSiteDefault, ownerId: p.ownerId,
        ownerName: names.get(p.ownerId) ?? '', trackCount: counts.get(p.id) ?? 0, canEdit: canEdit(p, viewer),
      }));
    return json(list);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return json({ error: 'Failed to fetch playlists' }, 500);
  }
};

// POST - Create a playlist (private unless said otherwise)
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const viewer = await getViewer(cookies);
    if (!viewer) return json({ error: 'Not logged in' }, 401);
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const name = cleanName(body?.name);
    if (!name) return json({ error: 'Name must be 1-80 characters' }, 400);
    const visibility = body.visibility ?? 'private';
    if (!isVisibility(visibility)) return json({ error: 'Visibility must be public or private' }, 400);
    const [created] = await db.insert(Playlist).values({ id: crypto.randomUUID(), ownerId: viewer.id, name, visibility }).returning();
    return json(created, 201);
  } catch (error) {
    console.error('Error creating playlist:', error);
    return json({ error: 'Failed to create playlist' }, 500);
  }
};
