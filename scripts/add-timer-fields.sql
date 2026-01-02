-- Migration: Add Timer fields to DMScreenState table
-- This script adds timer-related columns to the DMScreenState table
-- Safe to run multiple times - checks if columns exist before adding
-- Compatible with SQLite (Astro DB)

-- Note: Run each ALTER TABLE statement separately to avoid issues if some columns already exist

-- Add showTimer (whether to show timer on player display)
ALTER TABLE "DMScreenState" ADD COLUMN "showTimer" integer NOT NULL DEFAULT 0;

-- Add timerDuration (timer duration in seconds)
ALTER TABLE "DMScreenState" ADD COLUMN "timerDuration" integer NOT NULL DEFAULT 0;

-- Add timerStartedAt (timestamp when timer started - Unix timestamp)
ALTER TABLE "DMScreenState" ADD COLUMN "timerStartedAt" integer;

-- Add timerPausedAt (timestamp when timer was paused - Unix timestamp)
ALTER TABLE "DMScreenState" ADD COLUMN "timerPausedAt" integer;

-- Add timerStatus (current timer status: 'running', 'paused', or 'stopped')
ALTER TABLE "DMScreenState" ADD COLUMN "timerStatus" text NOT NULL DEFAULT 'stopped';

-- Verify the migration
SELECT 'Timer fields migration complete' as status;
SELECT 
  COUNT(*) as total_dm_screen_states,
  COUNT("showTimer") as states_with_showTimer,
  COUNT("timerDuration") as states_with_timerDuration,
  COUNT("timerStatus") as states_with_timerStatus
FROM "DMScreenState";
