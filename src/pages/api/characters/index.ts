import type { APIRoute } from 'astro';
import { db, Character, User, eq } from '@/db';
import { requirePlayerOrAbove } from '../../../lib/middleware';
import { getCurrentUser } from '../../../lib/auth';

export const GET: APIRoute = async () => {
  try {
    const characters = await db.select().from(Character);
    return new Response(JSON.stringify(characters), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch characters' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const id = crypto.randomUUID();
    const now = new Date();
    
    // Get current user for auto-assignment
    const currentUser = await getCurrentUser(cookies);
    
    // Determine userId: only assign if assignToUser is explicitly true
    const assignToUser = body.assignToUser === true;
    const userId = assignToUser && currentUser ? currentUser.id : undefined;
    
    await db.insert(Character).values({
      id,
      name: body.name,
      class: body.class,
      level: body.level,
      race: body.race,
      player: body.player,
      userId: userId,
      isActive: body.isActive !== undefined ? body.isActive : true,
      avatarUrl: body.avatarUrl,
      dndbeyondUrl: body.dndbeyondUrl,
      stats: body.stats,
      // HP fields (optional)
      hp: body.hp,
      maxHp: body.maxHp,
      tempHp: body.tempHp,
      // Additional character details
      gender: body.gender,
      alignment: body.alignment,
      background: body.background,
      age: body.age,
      height: body.height,
      weight: body.weight,
      eyes: body.eyes,
      skin: body.skin,
      hair: body.hair,
      createdAt: now,
      updatedAt: now,
    });

    // If character is assigned to user, update user's characterIds array
    if (userId && currentUser) {
      const currentCharacterIds = (currentUser.characterIds as string[]) || [];
      if (!currentCharacterIds.includes(id)) {
        await db.update(User)
          .set({ characterIds: [...currentCharacterIds, id] })
          .where(eq(User.id, userId));
      }
    }

    const newCharacter = await db.select().from(Character).where(eq(Character.id, id));
    
    return new Response(JSON.stringify(newCharacter[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create character' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
