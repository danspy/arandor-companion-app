import type { APIRoute } from 'astro';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
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

function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export const GET: APIRoute = async ({ params, request }) => {
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
      // Get file stats for size information
      const fileStats = await stat(filepath);
      const fileSize = fileStats.size;
      
      // Determine content type from file extension
      const mimeType = getMimeType(file);
      
      // Handle Range requests for video streaming (required for mobile browsers)
      const rangeHeader = request.headers.get('range');
      
      if (rangeHeader && isVideoMimeType(mimeType)) {
        // Parse Range header (format: "bytes=start-end")
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        
        // Validate range - check for NaN, negative values, and out-of-bounds
        if (isNaN(start) || isNaN(end) || start < 0 || end < 0 || 
            start >= fileSize || end >= fileSize || start > end) {
          return new Response('Range Not Satisfiable', { 
            status: 416,
            headers: {
              'Content-Range': `bytes */${fileSize}`
            }
          });
        }
        
        const chunkSize = (end - start) + 1;
        
        // Create readable stream for the requested range
        const stream = createReadStream(filepath, { start, end });
        
        // Convert Node.js stream to Web Stream
        const webStream = new ReadableStream({
          start(controller) {
            stream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)));
            stream.on('end', () => controller.close());
            stream.on('error', (err) => controller.error(err));
          },
          cancel() {
            stream.destroy();
          }
        });
        
        // Return partial content response (206)
        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': chunkSize.toString(),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      }
      
      // For non-Range requests or non-video files, serve the complete file
      const buffer = await readFile(filepath);
      
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': isVideoMimeType(mimeType) ? 'bytes' : 'none',
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
