import type { APIRoute } from 'astro';
import { requireAuth } from '../../lib/middleware';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import crypto from 'node:crypto';

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate file type (images only)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Only images are allowed.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return new Response(JSON.stringify({ error: 'File too large. Maximum size is 5MB.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `${crypto.randomUUID()}.${ext}`;
    
    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Ensure upload directory exists
    // In production (standalone mode), save to dist/client/uploads
    // In development, save to public/uploads
    const isDev = import.meta.env.DEV;
    const uploadDir = isDev 
      ? join(process.cwd(), 'public', 'uploads')
      : join(process.cwd(), 'dist', 'client', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    
    // Save to uploads directory
    const filepath = join(uploadDir, filename);
    
    await writeFile(filepath, buffer);
    
    // Return the public URL
    const url = `/uploads/${filename}`;
    
    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
