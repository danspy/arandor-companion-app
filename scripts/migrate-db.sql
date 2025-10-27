-- Database Migration Script
-- This script adds the LibraryEntry table if it doesn't exist
-- Safe to run multiple times - will not affect existing data

-- Create LibraryEntry table
-- Schema matches db/config.ts LibraryEntry definition
CREATE TABLE IF NOT EXISTS "LibraryEntry" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "tags" text NOT NULL DEFAULT '[]',
  "locationId" text,
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'),
  "updatedAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Verify the table was created
SELECT 'LibraryEntry table migration complete' as status;
