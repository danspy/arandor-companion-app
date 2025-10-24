import type { APIRoute } from 'astro';
import { db, DiaryEntry, eq } from 'astro:db';

export const GET: APIRoute = async () => {
  try {
    const entries = await db.select().from(DiaryEntry);
    return new Response(JSON.stringify(entries), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch diary entries' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const id = crypto.randomUUID();
    const now = new Date();
    
    await db.insert(DiaryEntry).values({
      id,
      date: body.date,
      title: body.title,
      content: body.content,
      session: body.session,
      tags: body.tags || [],
      createdAt: now,
      updatedAt: now,
    });

    const newEntry = await db.select().from(DiaryEntry).where(eq(DiaryEntry.id, id));
    
    return new Response(JSON.stringify(newEntry[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create diary entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
