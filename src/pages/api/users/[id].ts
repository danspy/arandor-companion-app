import type { APIRoute } from 'astro';
import { db, User, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';
import { hashPassword, verifyPassword } from '../../../lib/auth';

export const GET: APIRoute = async ({ params, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    // Validate params.id
    if (!params.id || typeof params.id !== 'string' || params.id.trim() === '') {
      return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await db.select({
      id: User.id,
      username: User.username,
      createdAt: User.createdAt,
    }).from(User).where(eq(User.id, params.id));
    
    if (user.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(user[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    // Validate params.id
    if (!params.id || typeof params.id !== 'string' || params.id.trim() === '') {
      return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validate input
    if (!currentPassword) {
      return new Response(JSON.stringify({ error: 'Current password is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!newPassword) {
      return new Response(JSON.stringify({ error: 'New password is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'New password must be at least 6 characters long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user exists before updating
    const existingUser = await db.select({
      id: User.id,
      username: User.username,
      passwordHash: User.passwordHash,
    }).from(User).where(eq(User.id, params.id));

    if (existingUser.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, existingUser[0].passwordHash);
    
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Current password is incorrect' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    
    await db.update(User)
      .set({
        passwordHash,
      })
      .where(eq(User.id, params.id));

    const updatedUser = await db.select({
      id: User.id,
      username: User.username,
      createdAt: User.createdAt,
    }).from(User).where(eq(User.id, params.id));
    
    return new Response(JSON.stringify(updatedUser[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return new Response(JSON.stringify({ error: 'Failed to update user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    // Validate params.id
    if (!params.id || typeof params.id !== 'string' || params.id.trim() === '') {
      return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user exists before deleting
    const existingUser = await db.select({
      id: User.id,
      username: User.username,
    }).from(User).where(eq(User.id, params.id));

    if (existingUser.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prevent deleting the admin user
    if (existingUser[0].username === 'admin') {
      return new Response(JSON.stringify({ error: 'Cannot delete the admin user' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await db.delete(User).where(eq(User.id, params.id));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
