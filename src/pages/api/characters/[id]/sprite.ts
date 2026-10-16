import type { APIRoute } from 'astro';
import { db, Character, eq } from 'astro:db';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { findFaceCrop } from '../../../../lib/face/detect';

/**
 * GET /api/characters/:id/sprite
 *
 * Turns the character's avatar into a 16×16 pixel-art head for the world map.
 * The face is located with a small cascade detector (see lib/face), shrunk
 * to 16×16 and reduced to a small palette. Results are cached in memory per
 * avatar URL.
 */
const HEAD = 16;
const cache = new Map<string, { body: Buffer; at: number }>();
const TTL = 1000 * 60 * 60 * 12;

async function loadAvatar(url: string): Promise<Buffer | null> {
  if (url.startsWith('/uploads/')) {
    const dir = import.meta.env.DEV ? join(process.cwd(), 'public', 'uploads') : '/srv/arandor/uploads';
    const full = resolve(dir, url.slice('/uploads/'.length));
    if (!full.startsWith(resolve(dir))) return null;
    return readFile(full).catch(() => null);
  }
  if (!/^https?:\/\//i.test(url)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Arandor Companion)' } });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; } finally { clearTimeout(t); }
}

/** sharp is a native module; load it lazily so a server without it still serves the map (generated heads). */
async function loadSharp() {
  try { return (await import('sharp')).default; } catch (err) { console.warn('[sprite] sharp unavailable, portrait heads disabled:', (err as Error).message); return null; }
}

async function pixelHead(src: Buffer): Promise<Buffer> {
  const sharp = await loadSharp();
  if (!sharp) throw new Error('sharp unavailable');
  const crop = await findFaceCrop(sharp, src);
  return sharp(src, { failOn: 'none' })
    .rotate()
    .extract({ left: crop.left, top: crop.top, width: crop.size, height: crop.size })
    .resize(HEAD, HEAD, { kernel: 'lanczos3' })
    .modulate({ saturation: 1.2 })
    .png({ palette: true, colours: 16, dither: 0 })
    .toBuffer();
}

export const GET: APIRoute = async ({ params }) => {
  const id = params.id || '';
  const rows = await db.select({ avatarUrl: Character.avatarUrl }).from(Character).where(eq(Character.id, id));
  const url = rows[0]?.avatarUrl;
  if (!url) return new Response(null, { status: 404 });

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) {
    return new Response(hit.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } });
  }
  const src = await loadAvatar(url);
  if (!src) { console.warn('[sprite] avatar not loadable:', url); return new Response(null, { status: 404 }); }
  try {
    const body = await pixelHead(src);
    cache.set(url, { body, at: Date.now() });
    return new Response(body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } });
  } catch (err) {
    console.error('[sprite] could not build pixel head for', id, err);
    return new Response(null, { status: 404 });
  }
};
