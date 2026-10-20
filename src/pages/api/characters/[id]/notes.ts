import type { APIRoute } from 'astro';
import { db, Character, CharacterNote, eq } from '@/db';
import { requireAuth } from '../../../../lib/middleware';
import { getCurrentUser, getUserRole } from '../../../../lib/auth';
import { canSeePrivateSheet } from '../../../../lib/character-sheet';

const MAX_LENGTH = 20_000;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// PUT - Replace a character's private notes (its player, the DM and admins); empty text removes them
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  const [character] = await db.select({ id: Character.id, userId: Character.userId }).from(Character).where(eq(Character.id, params.id!));
  if (!character) return json({ error: 'Character not found' }, 404);
  if (!canSeePrivateSheet(character, await getCurrentUser(cookies), await getUserRole(cookies))) {
    return json({ error: 'Only the character’s player, the DM and admins can edit these notes' }, 403);
  }

  const body = await request.json().catch(() => null);
  const content = body?.content;
  if (typeof content !== 'string') return json({ error: 'content must be text' }, 400);
  if (content.length > MAX_LENGTH) return json({ error: `Notes can be at most ${MAX_LENGTH} characters` }, 400);

  try {
    if (!content.trim()) {
      await db.delete(CharacterNote).where(eq(CharacterNote.characterId, character.id));
    } else {
      const updatedAt = new Date();
      await db.insert(CharacterNote).values({ characterId: character.id, content, updatedAt })
        .onConflictDoUpdate({ target: CharacterNote.characterId, set: { content, updatedAt } });
    }
    return json({ success: true });
  } catch (error) {
    console.error('Error saving character notes:', error);
    return json({ error: 'Failed to save notes' }, 500);
  }
};
