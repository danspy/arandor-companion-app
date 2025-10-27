-- Database Migration Script
-- This script adds the LibraryEntry table if it doesn't exist
-- Safe to run multiple times - will not affect existing data

-- Create LibraryEntry table
CREATE TABLE IF NOT EXISTS "LibraryEntry" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "tags" text NOT NULL DEFAULT '[]',
  "locationId" text,
  "createdAt" text NOT NULL DEFAULT (datetime('now')),
  "updatedAt" text NOT NULL DEFAULT (datetime('now'))
);

-- Verify the table was created
SELECT 'LibraryEntry table migration complete' as status;
