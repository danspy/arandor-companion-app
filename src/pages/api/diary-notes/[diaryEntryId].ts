import type { APIRoute } from 'astro';
import { db, DiaryNote, eq, and } from '@/db';
import { requireAuth } from '../../../lib/middleware';
import { getCurrentUser } from '../../../lib/auth';

// GET - Fetch user's note for a specific diary entry
export const GET: APIRoute = async ({ params, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const notes = await db.select()
      .from(DiaryNote)
      .where(
        and(
          eq(DiaryNote.diaryEntryId, params.diaryEntryId!),
          eq(DiaryNote.userId, currentUser.id)
        )
      );
    
    if (notes.length === 0) {
      return new Response(JSON.stringify({ note: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ note: notes[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching diary note:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch diary note' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST - Create a new note for a diary entry
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const now = new Date();
    
    // Check if user already has a note for this diary entry
    const existingNotes = await db.select()
      .from(DiaryNote)
      .where(
        and(
          eq(DiaryNote.diaryEntryId, params.diaryEntryId!),
          eq(DiaryNote.userId, currentUser.id)
        )
      );

    if (existingNotes.length > 0) {
      return new Response(JSON.stringify({ error: 'Note already exists. Use PUT to update.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const noteId = crypto.randomUUID();
    await db.insert(DiaryNote).values({
      id: noteId,
      diaryEntryId: params.diaryEntryId!,
      userId: currentUser.id,
      content: body.content || '',
      createdAt: now,
      updatedAt: now,
    });

    const newNote = await db.select()
      .from(DiaryNote)
      .where(eq(DiaryNote.id, noteId));

    return new Response(JSON.stringify({ note: newNote[0] }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating diary note:', error);
    return new Response(JSON.stringify({ error: 'Failed to create diary note' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT - Update an existing note
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const now = new Date();
    
    // Find the user's note for this diary entry
    const existingNotes = await db.select()
      .from(DiaryNote)
      .where(
        and(
          eq(DiaryNote.diaryEntryId, params.diaryEntryId!),
          eq(DiaryNote.userId, currentUser.id)
        )
      );

    if (existingNotes.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await db.update(DiaryNote)
      .set({
        content: body.content || '',
        updatedAt: now,
      })
      .where(eq(DiaryNote.id, existingNotes[0].id));

    const updatedNote = await db.select()
      .from(DiaryNote)
      .where(eq(DiaryNote.id, existingNotes[0].id));

    return new Response(JSON.stringify({ note: updatedNote[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating diary note:', error);
    return new Response(JSON.stringify({ error: 'Failed to update diary note' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// DELETE - Delete a user's note
export const DELETE: APIRoute = async ({ params, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await db.delete(DiaryNote)
      .where(
        and(
          eq(DiaryNote.diaryEntryId, params.diaryEntryId!),
          eq(DiaryNote.userId, currentUser.id)
        )
      );
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting diary note:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete diary note' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
