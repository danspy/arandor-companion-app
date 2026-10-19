import type { APIRoute } from 'astro';
import { db, Character, User, eq } from '@/db';
import { requirePlayerOrAbove } from '../../../lib/middleware';
import { getCurrentUser, getUserRole } from '../../../lib/auth';
import { canSeePrivateSheet, forViewer } from '../../../lib/character-sheet';

export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const character = await db.select().from(Character).where(eq(Character.id, params.id!));
    
    if (character.length === 0) {
      return new Response(JSON.stringify({ error: 'Character not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Skills, attacks, features and inventory only for the player, the DM and admins
    const canSee = canSeePrivateSheet(character[0], await getCurrentUser(cookies), await getUserRole(cookies));
    return new Response(JSON.stringify(forViewer(character[0], canSee)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch character' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    const body = await request.json();
    const now = new Date();
    
    // Get current user and their role
    const currentUser = await getCurrentUser(cookies);
    const userRole = await getUserRole(cookies);
    
    // Check if character exists and get its ownership info
    const existingCharacter = await db.select().from(Character).where(eq(Character.id, params.id!));
    
    if (existingCharacter.length === 0) {
      return new Response(JSON.stringify({ error: 'Character not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const character = existingCharacter[0];
    
    // Check if user has permission to edit this character
    // Admins can edit any character
    // Non-admins can only edit characters they own (or unowned characters)
    const isAdmin = userRole === 'admin';
    const isOwner = currentUser && character.userId === currentUser.id;
    const isUnowned = !character.userId;
    
    if (!isAdmin && !isOwner && !isUnowned) {
      return new Response(JSON.stringify({ 
        error: 'You do not have permission to edit this character. Only the character owner or admins can edit it.' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if stats are being updated - if so, mark them as manually edited
    const statsChanged = body.stats && JSON.stringify(body.stats) !== JSON.stringify(character.stats);
    
    console.log('[Character Update] Stats changed:', statsChanged);
    console.log('[Character Update] Old stats:', JSON.stringify(character.stats));
    console.log('[Character Update] New stats:', JSON.stringify(body.stats));
    
    const updateData: any = {
      name: body.name,
      class: body.class,
      level: body.level,
      race: body.race,
      player: body.player,
      isActive: body.isActive !== undefined ? body.isActive : true,
      avatarUrl: body.avatarUrl,
      dndbeyondUrl: body.dndbeyondUrl,
      stats: body.stats,
      // HP fields (optional, can be updated manually or via sync)
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
      updatedAt: now,
    };
    // A sheet read from another (or no) D&D Beyond link is not this character's: the next sync writes a new one
    if ((body.dndbeyondUrl || null) !== (character.dndbeyondUrl || null)) updateData.sheet = null;
    
    // Mark stats as manually edited if they changed
    if (statsChanged) {
      console.log('[Character Update] MARKING stats as manually edited');
      updateData.statsManuallyEdited = true;
    }
    
    await db.update(Character)
      .set(updateData)
      .where(eq(Character.id, params.id!));

    const updatedCharacter = await db.select().from(Character).where(eq(Character.id, params.id!));
    
    return new Response(JSON.stringify(forViewer(updatedCharacter[0], canSeePrivateSheet(updatedCharacter[0], currentUser, userRole))), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update character' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = await requirePlayerOrAbove(cookies);
  if (authError) return authError;

  try {
    // Get current user and their role
    const currentUser = await getCurrentUser(cookies);
    const userRole = await getUserRole(cookies);
    
    // Check if character exists and get its ownership info
    const existingCharacter = await db.select().from(Character).where(eq(Character.id, params.id!));
    
    if (existingCharacter.length === 0) {
      return new Response(JSON.stringify({ error: 'Character not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const character = existingCharacter[0];
    
    // Check if user has permission to delete this character
    // Admins can delete any character
    // Non-admins can only delete characters they own (or unowned characters)
    const isAdmin = userRole === 'admin';
    const isOwner = currentUser && character.userId === currentUser.id;
    const isUnowned = !character.userId;
    
    if (!isAdmin && !isOwner && !isUnowned) {
      return new Response(JSON.stringify({ 
        error: 'You do not have permission to delete this character. Only the character owner or admins can delete it.' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // If character is owned, remove it from the user's characterIds
    if (character.userId) {
      const owner = await db.select().from(User).where(eq(User.id, character.userId));
      if (owner.length > 0) {
        const currentCharacterIds = (owner[0].characterIds as string[]) || [];
        const updatedCharacterIds = currentCharacterIds.filter(id => id !== params.id);
        await db.update(User)
          .set({ characterIds: updatedCharacterIds })
          .where(eq(User.id, character.userId));
      }
    }
    
    await db.delete(Character).where(eq(Character.id, params.id!));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete character' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
