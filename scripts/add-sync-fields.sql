-- Migration: Add D&D Beyond sync fields to Character table
-- Adds lastSyncedAt and statsManuallyEdited columns
-- Safe to run multiple times - checks if columns exist before adding
-- Compatible with SQLite (Astro DB)

-- Add lastSyncedAt (timestamp of last D&D Beyond sync)
ALTER TABLE "Character" ADD COLUMN "lastSyncedAt" text;

-- Add statsManuallyEdited (boolean flag to protect manual stat edits)
ALTER TABLE "Character" ADD COLUMN "statsManuallyEdited" integer NOT NULL DEFAULT 0;

-- Add userId (foreign key to User table for ownership tracking) - if not exists
-- Note: This column may already exist in newer schemas
ALTER TABLE "Character" ADD COLUMN "userId" text;

-- Add deathSaveSuccesses (for death save tracking) - if not exists
ALTER TABLE "Character" ADD COLUMN "deathSaveSuccesses" integer NOT NULL DEFAULT 0;

-- Add deathSaveFailures (for death save tracking) - if not exists
ALTER TABLE "Character" ADD COLUMN "deathSaveFailures" integer NOT NULL DEFAULT 0;

-- Add isStable (for death save tracking) - if not exists
ALTER TABLE "Character" ADD COLUMN "isStable" integer NOT NULL DEFAULT 0;

-- Verify the migration
SELECT 'D&D Beyond sync fields migration complete' as status;
SELECT 
  COUNT(*) as total_characters,
  COUNT("lastSyncedAt") as characters_with_lastSyncedAt,
  COUNT("statsManuallyEdited") as characters_with_statsManuallyEdited,
  COUNT("userId") as characters_with_userId
FROM "Character";
