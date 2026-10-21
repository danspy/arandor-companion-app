import type { APIRoute } from 'astro';
import { db, DiaryEntry } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { diaryExcerpt, diaryImage, startDefaults } from '../../../lib/scenes';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// GET - Pre-filled start screen: next session number, today (server local date) and the last
// recap, plus the diary entries for "Title + last session" (newest first, with excerpt and image)
export const GET: APIRoute = async ({ cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;
  try {
    const rows = await db.select({
      id: DiaryEntry.id, session: DiaryEntry.session, title: DiaryEntry.title, summary: DiaryEntry.summary,
      content: DiaryEntry.content, coverImageUrl: DiaryEntry.coverImageUrl, galleryUrls: DiaryEntry.galleryUrls,
    }).from(DiaryEntry);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const diary = rows
      .sort((a, b) => b.session - a.session)
      .map((e) => ({ id: e.id, session: e.session, title: e.title, excerpt: diaryExcerpt(e), imageUrl: diaryImage(e) }));
    return json({ ...startDefaults(rows, today), diaryEntryId: diary[0]?.id ?? null, diary });
  } catch (error) {
    console.error('Error building start defaults:', error);
    return json({ error: 'Failed to build start defaults' }, 500);
  }
};
