// Server-side helpers for the music player API. Pure rules live in access.ts.
import type { AstroCookies } from 'astro';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { db, Playlist, PlaylistTrack, User, eq } from '@/db';
import { getCurrentUser } from '../auth';
import type { Viewer } from './access';

export type PlaylistRow = typeof Playlist.$inferSelect;
export type PlaylistTrackRow = typeof PlaylistTrack.$inferSelect;
export type PlaylistWithTracks = PlaylistRow & { tracks: PlaylistTrackRow[] };
export type PlaylistSummary = {
  id: string; name: string; visibility: string; isSiteDefault: boolean;
  ownerId: string; ownerName: string; trackCount: number; canEdit: boolean;
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function getViewer(cookies: AstroCookies): Promise<Viewer> {
  const user = await getCurrentUser(cookies);
  return user ? { id: user.id, role: user.role || 'player' } : null;
}

const MUSIC_PREFIX = '/uploads/music/';

// The music/ sub-folder of the upload directory (same rule as /api/upload), created on demand
export function musicDir(): string {
  const uploadDir = import.meta.env.DEV
    ? join(process.cwd(), 'public', 'uploads')
    : process.env.UPLOAD_DIR || '/srv/arandor/uploads';
  const dir = join(uploadDir, 'music');
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Deletes an uploaded music file. Only refs under /uploads/music/ count; anything resolving outside the folder is refused.
export async function deleteMusicFile(ref: string): Promise<void> {
  if (!ref.startsWith(MUSIC_PREFIX)) return;
  const dir = resolve(musicDir());
  const target = resolve(dir, ref.slice(MUSIC_PREFIX.length));
  if (!target.startsWith(dir + sep)) return;
  try {
    await unlink(target);
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e;
  }
}

async function tracksOf(playlistId: string): Promise<PlaylistTrackRow[]> {
  const tracks = await db.select().from(PlaylistTrack).where(eq(PlaylistTrack.playlistId, playlistId));
  return tracks.sort((a, b) => a.position - b.position);
}

export async function loadPlaylist(id: string): Promise<PlaylistWithTracks | null> {
  const [p] = await db.select().from(Playlist).where(eq(Playlist.id, id));
  return p ? { ...p, tracks: await tracksOf(p.id) } : null;
}

export async function loadSitePlaylist(): Promise<PlaylistWithTracks | null> {
  const [p] = await db.select().from(Playlist).where(eq(Playlist.isSiteDefault, true));
  return p ? { ...p, tracks: await tracksOf(p.id) } : null;
}

export async function ownerNames(): Promise<Map<string, string>> {
  const users = await db.select({ id: User.id, firstName: User.firstName, username: User.username }).from(User);
  return new Map(users.map((u) => [u.id, u.firstName || u.username]));
}

// Name rule: trimmed, 1-80 chars
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const name = v.trim();
  return name.length >= 1 && name.length <= 80 ? name : null;
}

export const isVisibility = (v: unknown): v is 'public' | 'private' => v === 'public' || v === 'private';
