import type { APIRoute } from 'astro';
import { db, User, eq } from 'astro:db';
import { getCurrentUser, hashPassword, verifyPassword } from '../../lib/auth';
import { requireAuth } from '../../lib/middleware';

// GET - Get current user's profile
export const GET: APIRoute = async ({ cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const user = await getCurrentUser(cookies);
    
    // Defense in depth: verify user exists even though requireAuth passed
    // This protects against edge cases where session exists but user was deleted
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return user profile without password hash
    return new Response(JSON.stringify({
      id: user.id,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      profileImageUrl: user.profileImageUrl,
      characterIds: user.characterIds,
      createdAt: user.createdAt,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT - Update current user's profile (password change only)
export const PUT: APIRoute = async ({ request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const user = await getCurrentUser(cookies);
    
    // Defense in depth: verify user exists even though requireAuth passed
    // This protects against edge cases where session exists but user was deleted
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { currentPassword, newPassword, firstName, profileImageUrl, characterIds } = body;

    // Handle profile information updates (firstName, profileImageUrl, characterIds)
    if (!currentPassword && !newPassword) {
      // Only updating profile info, no password change
      const updateData: any = {};
      
      if (firstName !== undefined) {
        updateData.firstName = firstName || null;
      }
      
      if (profileImageUrl !== undefined) {
        updateData.profileImageUrl = profileImageUrl || null;
      }
      
      if (characterIds !== undefined) {
        // Validate that characterIds is an array
        if (!Array.isArray(characterIds)) {
          return new Response(JSON.stringify({ error: 'characterIds must be an array' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        updateData.characterIds = characterIds;
      }
      
      // Update user profile
      await db.update(User)
        .set(updateData)
        .where(eq(User.id, user.id));

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Profile updated successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate that both passwords are provided for password change
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ error: 'Both current password and new password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'New password must be at least 6 characters long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Current password is incorrect' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    await db.update(User)
      .set({ passwordHash })
      .where(eq(User.id, user.id));

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Password updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
