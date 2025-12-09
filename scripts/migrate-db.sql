-- Database Migration Script
-- This script ensures all tables exist with the correct schema
-- Safe to run multiple times - will not affect existing data
-- Schema matches db/config.ts definitions

-- Helper: ISO timestamp default for SQLite
-- Use: (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')

-- Create DiaryEntry table
CREATE TABLE IF NOT EXISTS "DiaryEntry" (
  "id" text PRIMARY KEY,
  "date" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "session" integer NOT NULL,
  "tags" text NOT NULL DEFAULT '[]',
  "coverImageUrl" text,
  "coverVideoUrl" text,
  "npcIds" text NOT NULL DEFAULT '[]',
  "locationIds" text NOT NULL DEFAULT '[]',
  "characterIds" text NOT NULL DEFAULT '[]',
  "questIds" text NOT NULL DEFAULT '[]',
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'),
  "updatedAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Create Quest table
CREATE TABLE IF NOT EXISTS "Quest" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "status" text NOT NULL,
  "priority" text NOT NULL,
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'),
  "updatedAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Create Character table
CREATE TABLE IF NOT EXISTS "Character" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "class" text NOT NULL,
  "level" integer NOT NULL,
  "race" text NOT NULL,
  "player" text NOT NULL,
  "isActive" integer NOT NULL DEFAULT 1,
  "avatarUrl" text,
  "dndbeyondUrl" text,
  "stats" text,
  "gender" text,
  "alignment" text,
  "background" text,
  "age" integer,
  "height" text,
  "weight" integer,
  "eyes" text,
  "skin" text,
  "hair" text,
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'),
  "updatedAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Add isActive column to existing Character table (if it doesn't exist)
-- This is safe to run even if the column already exists
-- SQLite will silently ignore the error if the column exists
-- All existing characters will default to active (1 = true)
ALTER TABLE "Character" ADD COLUMN "isActive" integer NOT NULL DEFAULT 1;

-- Add coverVideoUrl column to existing DiaryEntry table (if it doesn't exist)
-- This is safe to run even if the column already exists
-- SQLite will silently ignore the error if the column exists
ALTER TABLE "DiaryEntry" ADD COLUMN "coverVideoUrl" text;

-- Add podcastAudioUrl column to existing DiaryEntry table (if it doesn't exist)
-- This is safe to run even if the column already exists
-- SQLite will silently ignore the error if the column exists
-- Stores URL/path to generated podcast MP3 file
ALTER TABLE "DiaryEntry" ADD COLUMN "podcastAudioUrl" text;

-- Create NPC table
CREATE TABLE IF NOT EXISTS "NPC" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "race" text NOT NULL,
  "occupation" text,
  "location" text,
  "locationId" text,
  "description" text NOT NULL,
  "relationship" text NOT NULL,
  "notes" text,
  "avatarUrl" text,
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'),
  "updatedAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Create Location table
CREATE TABLE IF NOT EXISTS "Location" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "region" text,
  "visited" integer NOT NULL DEFAULT 0,
  "notes" text,
  "mapX" real,
  "mapY" real,
  "visibleOnMap" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'),
  "updatedAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Create User table
CREATE TABLE IF NOT EXISTS "User" (
  "id" text PRIMARY KEY,
  "username" text NOT NULL UNIQUE,
  "passwordHash" text NOT NULL,
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Create CampaignProgress table
CREATE TABLE IF NOT EXISTS "CampaignProgress" (
  "id" text PRIMARY KEY,
  "currentLevel" integer NOT NULL,
  "progressPercent" integer NOT NULL,
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'),
  "updatedAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Create LibraryEntry table
CREATE TABLE IF NOT EXISTS "LibraryEntry" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "tags" text NOT NULL DEFAULT '[]',
  "locationId" text,
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'),
  "updatedAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Create Faction table
CREATE TABLE IF NOT EXISTS "Faction" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "status" text NOT NULL,
  "progress" integer NOT NULL DEFAULT 50,
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'),
  "updatedAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Add heroImageUrl column to existing CampaignProgress table (if it doesn't exist)
-- This is safe to run even if the column already exists
-- SQLite will silently ignore the error if the column exists
ALTER TABLE "CampaignProgress" ADD COLUMN "heroImageUrl" text;

-- Add imageUrl column to existing Location table (if it doesn't exist)
-- This is safe to run even if the column already exists
-- SQLite will silently ignore the error if the column exists
ALTER TABLE "Location" ADD COLUMN "imageUrl" text;

-- Create PageSettings table for storing hero images per page
CREATE TABLE IF NOT EXISTS "PageSettings" (
  "id" text PRIMARY KEY,
  "pageName" text NOT NULL UNIQUE,
  "heroImageUrl" text,
  "createdAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'),
  "updatedAt" text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z')
);

-- Verify the migration completed
SELECT 'Database migration complete - all tables ensured' as status;
