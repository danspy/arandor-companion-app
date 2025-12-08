import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

// Simple MIME type mapping for common image and video formats
const MIME_TYPES: Record<string, string> = {
  // Images
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  'bmp': 'image/bmp',
  'ico': 'image/x-icon',
  // Videos
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'ogg': 'video/ogg',
  'ogv': 'video/ogg',
  'mov': 'video/quicktime',
  'avi': 'video/x-msvideo',
  'wmv': 'video/x-ms-wmv',
  'flv': 'video/x-flv',
  'mkv': 'video/x-matroska',
  'm4v': 'video/x-m4v',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
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
    const resolvedUploadDir = resolve(uploadDir);
    
    // Security check: Prevent directory traversal and path manipulation attacks
    // Ensures filepath is within uploadDir (either directly or in subdirectories)
    // but not the directory itself, preventing both traversal and directory listing
    if (filepath === resolvedUploadDir || !filepath.startsWith(resolvedUploadDir + sep)) {
      console.error('[uploads] Security check failed:', { filepath, resolvedUploadDir, file });
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
