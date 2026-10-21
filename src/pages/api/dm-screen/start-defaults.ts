import type { APIRoute } from 'astro';
import { db, DiaryEntry } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { startDefaults } from '../../../lib/scenes';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// GET - Pre-filled start screen: next session number, today (server local date) and the last recap
export const GET: APIRoute = async ({ cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    const diary = await db.select({ session: DiaryEntry.session, summary: DiaryEntry.summary }).from(DiaryEntry);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return json(startDefaults(diary, today));
  } catch (error) {
    console.error('Error building start defaults:', error);
    return json({ error: 'Failed to build start defaults' }, 500);
  }
};
