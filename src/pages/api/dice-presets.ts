import type { APIRoute } from 'astro';
import { db, User, eq } from '@/db';
import { getCurrentUser } from '../../lib/auth';
import { requireAuth } from '../../lib/middleware';
import { validatePresets } from '../../lib/dice-notation';

// The logged-in user's own saved dice rolls. There is no way to read or change anyone else's.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// GET - My presets
export const GET: APIRoute = async ({ cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;
  try {
    const user = await getCurrentUser(cookies);
    if (!user) return json({ error: 'User not found' }, 404);
    return json(user.dicePresets ?? []);
  } catch (error) {
    console.error('Error fetching dice presets:', error);
    return json({ error: 'Failed to fetch dice presets' }, 500);
  }
};

// PUT - Replace my presets with the list sent (add, edit, reorder and delete all go through here)
export const PUT: APIRoute = async ({ request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;
  try {
    const user = await getCurrentUser(cookies);
    if (!user) return json({ error: 'User not found' }, 404);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const checked = validatePresets(body);
    if (!checked.ok) return json({ error: checked.error }, 400);
    await db.update(User).set({ dicePresets: checked.presets }).where(eq(User.id, user.id));
    return json(checked.presets);
  } catch (error) {
    console.error('Error saving dice presets:', error);
    return json({ error: 'Failed to save dice presets' }, 500);
  }
};
