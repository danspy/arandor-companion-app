import type { APIRoute } from 'astro';
import { db, DiaryEntry, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../../../lib/middleware';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Removes a diary entry's summary (the "Delete summary" button on the entry page).
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const [entry] = await db.select({ id: DiaryEntry.id }).from(DiaryEntry).where(eq(DiaryEntry.id, params.id!));
    if (!entry) return json({ error: 'Entry not found' }, 404);

    await db.update(DiaryEntry).set({ summary: null, updatedAt: new Date() }).where(eq(DiaryEntry.id, entry.id));
    return json({ success: true });
  } catch (error) {
    console.error('Error deleting diary summary:', error);
    return json({ error: 'Failed to delete summary' }, 500);
  }
};
