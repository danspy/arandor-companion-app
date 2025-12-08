import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

// Simple MIME type mapping for common image and video formats
const MIME_TYPES: Record<string, string> = {
  // Images
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  // Videos
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'ogg': 'video/ogg',
  'mov': 'video/quicktime',
};

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export const GET: APIRoute = async ({ params }) => {
  try {
    const file = params.file || '';
    
    if (!file) {
      return new Response('File not found', { status: 404 });
    }

    // In development, serve from public/uploads
    // In production, serve from persistent uploads directory
    const isDev = import.meta.env.DEV;
    const uploadDir = isDev 
      ? join(process.cwd(), 'public', 'uploads')
      : '/srv/arandor/uploads';
    
    // Resolve the full path and ensure it's within the uploads directory
    const filepath = resolve(uploadDir, file);
    const relativePath = relative(uploadDir, filepath);
    
    // Prevent directory traversal attacks - ensure the resolved path is within uploadDir
    // If relativePath starts with "..", it means the file is outside the upload directory
    if (relativePath.startsWith('..') || relativePath.startsWith('/')) {
      return new Response('Invalid file path', { status: 400 });
    }
    
    try {
      const buffer = await readFile(filepath);
      
      // Determine content type from file extension
      const mimeType = getMimeType(file);
      
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    } catch (error) {
      return new Response('File not found', { status: 404 });
    }
  } catch (error) {
    console.error('File serving error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
