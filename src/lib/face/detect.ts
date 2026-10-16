/**
 * Finds the face in a character avatar and returns a square crop
 * (in source pixels). Uses the pico.js cascade; falls back to a
 * top-centre crop when nothing is detected.
 */
import type Sharp from 'sharp';
import pico from './pico';
import { FACEFINDER_B64 } from './facefinder';

let classify: ((r: number, c: number, s: number, img: { pixels: Uint8Array; nrows: number; ncols: number; ldim: number }) => number) | null = null;
function cascade() {
  if (!classify) classify = pico.unpack_cascade(new Int8Array(Buffer.from(FACEFINDER_B64, 'base64')));
  return classify!;
}

export interface Crop { left: number; top: number; size: number; detected: boolean }

export async function findFaceCrop(sharp: typeof Sharp, src: Buffer): Promise<Crop> {
  const img = sharp(src, { failOn: 'none' }).rotate();
  const { width: W = 0, height: H = 0 } = await img.metadata();
  if (!W || !H) throw new Error('no image');

  let best: { q: number; r: number; c: number; s: number } | null = null;
  for (const w of [320, 480]) {
    const h = Math.round((H / W) * w);
    const { data } = await img.clone().resize(w, h).greyscale().raw().toBuffer({ resolveWithObject: true });
    let dets: number[][] = pico.run_cascade({ pixels: data, nrows: h, ncols: w, ldim: w }, cascade(), { shiftfactor: 0.1, minsize: 20, maxsize: Math.max(w, h), scalefactor: 1.1 });
    dets = pico.cluster_detections(dets, 0.2);
    for (const [r, c, s, q] of dets) {
      if (q < 8) continue; // low-quality hits are mostly background texture
      const cand = { q, r: r / h, c: c / w, s: s / w };
      if (!best || cand.q > best.q) best = cand;
    }
  }
  if (best) {
    const size = Math.min(W, H, Math.round(best.s * W * 1.4));
    const left = Math.max(0, Math.min(W - size, Math.round(best.c * W - size / 2)));
    const top = Math.max(0, Math.min(H - size, Math.round(best.r * H - size / 2)));
    return { left, top, size, detected: true };
  }
  // Fallback: a tight upper-centre square. Tall images keep the head near the top.
  const tall = H > W * 1.25;
  const size = Math.round(tall ? W * 0.45 : Math.min(W, H) * 0.55);
  const left = Math.round((W - size) / 2);
  const top = tall ? Math.round(H * 0.1) : Math.round(Math.max(0, (H - size) * 0.2));
  return { left, top: Math.min(top, H - size), size, detected: false };
}
