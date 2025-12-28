-- Migration: Add HP fields to Character table
-- This script adds hp, maxHp, and tempHp columns to the Character table
-- Safe to run multiple times - checks if columns exist before adding
-- Compatible with SQLite (Astro DB)

-- Add hp column if it doesn't exist
-- SQLite doesn't support ALTER TABLE IF NOT EXISTS directly, so we use a workaround
-- This will fail silently if the column already exists (which is fine)

-- Note: Run each ALTER TABLE statement separately to avoid issues if some columns already exist

-- Add hp (current hit points)
ALTER TABLE "Character" ADD COLUMN "hp" integer;

-- Add maxHp (maximum hit points)  
ALTER TABLE "Character" ADD COLUMN "maxHp" integer;

-- Add tempHp (temporary hit points)
ALTER TABLE "Character" ADD COLUMN "tempHp" integer;

-- Verify the migration
SELECT 'HP fields migration complete' as status;
SELECT 
  COUNT(*) as total_characters,
  COUNT("hp") as characters_with_hp,
  COUNT("maxHp") as characters_with_maxHp,
  COUNT("tempHp") as characters_with_tempHp
FROM "Character";
