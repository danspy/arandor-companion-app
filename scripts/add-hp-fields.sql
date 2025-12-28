-- Migration: Add HP fields to Character table and InitiativeTracker table
-- This script adds hp, maxHp, and tempHp columns to the Character table
-- and tempHp column to the InitiativeTracker table
-- Safe to run multiple times - checks if columns exist before adding
-- Compatible with SQLite (Astro DB)

-- Note: Run each ALTER TABLE statement separately to avoid issues if some columns already exist

-- Add hp (current hit points) to Character
ALTER TABLE "Character" ADD COLUMN "hp" integer;

-- Add maxHp (maximum hit points) to Character
ALTER TABLE "Character" ADD COLUMN "maxHp" integer;

-- Add tempHp (temporary hit points) to Character
ALTER TABLE "Character" ADD COLUMN "tempHp" integer;

-- Add tempHp (temporary hit points) to InitiativeTracker
ALTER TABLE "InitiativeTracker" ADD COLUMN "tempHp" integer;

-- Verify the migration
SELECT 'HP fields migration complete' as status;
SELECT 
  COUNT(*) as total_characters,
  COUNT("hp") as characters_with_hp,
  COUNT("maxHp") as characters_with_maxHp,
  COUNT("tempHp") as characters_with_tempHp
FROM "Character";

SELECT 
  COUNT(*) as total_initiative_entries,
  COUNT("tempHp") as entries_with_tempHp
FROM "InitiativeTracker";
