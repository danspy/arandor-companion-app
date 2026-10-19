import type { APIRoute } from 'astro';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db, PlaylistTrack } from '@/db';
import { canView, canEdit } from '../../../../../lib/music/access';
import { audioFileCheck } from '../../../../../lib/music/formats';
import { parseYouTubeUrl, fetchYouTubeTitle } from '../../../../../lib/music/youtube';
import { json, getViewer, loadPlaylist, musicDir, deleteMusicFile, type PlaylistWithTracks } from '../../../../../lib/music/server';

type Result = { name: string; ok: boolean; track?: typeof PlaylistTrack.$inferSelect; error?: string };

const nextPosition = (p: PlaylistWithTracks) => p.tracks.reduce((m, t) => Math.max(m, t.position), -1) + 1;

// POST - Add uploaded audio files (multipart) or a YouTube link (JSON)
export const POST: APIRoute = async ({ params, request, cookies }) => {
  try {
    const viewer = await getViewer(cookies);
    if (!viewer) return json({ error: 'Not logged in' }, 401);
    const playlist = await loadPlaylist(params.id!);
    if (!playlist || !canView(playlist, viewer)) return json({ error: 'Playlist not found' }, 404);
    if (!canEdit(playlist, viewer)) return json({ error: 'You cannot change this playlist' }, 403);

    const contentType = request.headers.get('content-type') || '';
    let position = nextPosition(playlist);

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const files = form.getAll('file').filter((f): f is File => typeof f !== 'string');
      if (!files.length) return json({ error: 'No files' }, 400);
      const results: Result[] = [];
      for (const file of files) {
        // formData() has already buffered the whole body; the size limit only stops the file being stored
        const check = audioFileCheck(file.name, file.size);
        if (!check.ok) {
          results.push({ name: file.name, ok: false, error: check.error });
          continue;
        }
        const ref = `/uploads/music/${crypto.randomUUID()}.${check.ext}`;
        const path = join(musicDir(), ref.slice('/uploads/music/'.length));
        try {
          await writeFile(path, Buffer.from(await file.arrayBuffer()));
          const [track] = await db.insert(PlaylistTrack).values({
            id: crypto.randomUUID(), playlistId: playlist.id, position: position++,
            kind: 'file', title: check.title || 'Untitled', ref,
          }).returning();
          results.push({ name: file.name, ok: true, track });
        } catch (e) {
          console.error('Error saving track:', e);
          await deleteMusicFile(ref).catch(() => {});
          results.push({ name: file.name, ok: false, error: 'Could not save the file' });
        }
      }
      return json({ results }, results.some((r) => r.ok) ? 201 : 400);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const parsed = typeof body?.youtubeUrl === 'string' ? parseYouTubeUrl(body.youtubeUrl) : null;
    if (!parsed) return json({ error: 'Not a YouTube video or playlist link' }, 400);
    let mode: 'video' | 'playlist';
    if (parsed.videoId && parsed.listId) {
      if (body.mode !== 'video' && body.mode !== 'playlist') return json({ needsMode: true }, 409);
      mode = body.mode;
    } else {
      mode = parsed.videoId ? 'video' : 'playlist';
    }
    const given = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    const title = given || (await fetchYouTubeTitle(body.youtubeUrl)) || body.youtubeUrl.trim();
    const [track] = await db.insert(PlaylistTrack).values({
      id: crypto.randomUUID(), playlistId: playlist.id, position,
      kind: mode === 'video' ? 'youtube_video' : 'youtube_playlist',
      title: title.slice(0, 200), ref: mode === 'video' ? parsed.videoId! : parsed.listId!,
    }).returning();
    return json(track, 201);
  } catch (error) {
    console.error('Error adding track:', error);
    return json({ error: 'Failed to add track' }, 500);
  }
};
