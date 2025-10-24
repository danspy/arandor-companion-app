import type { APIRoute } from 'astro';
import { db, DiaryEntry, eq } from 'astro:db';

export const GET: APIRoute = async ({ params }) => {
  try {
    const entry = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, params.id!));
    
    if (entry.length === 0) {
      return new Response(JSON.stringify({ error: 'Entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(entry[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch diary entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const body = await request.json();
    const now = new Date();
    
    await db.update(DiaryEntry)
      .set({
        date: body.date,
        title: body.title,
        content: body.content,
        session: body.session,
        tags: body.tags,
        updatedAt: now,
      })
      .where(eq(DiaryEntry.id, params.id!));

    const updatedEntry = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, params.id!));
    
    return new Response(JSON.stringify(updatedEntry[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update diary entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    await db.delete(DiaryEntry).where(eq(DiaryEntry.id, params.id!));
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to delete diary entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
