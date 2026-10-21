-- Display mode replaces the on/off screenVisible switch: live, start screen or pause.
ALTER TABLE DMScreenState ADD COLUMN screenMode text NOT NULL DEFAULT 'live';
ALTER TABLE DMScreenState ADD COLUMN startScreen text;
UPDATE DMScreenState SET screenMode = 'pause' WHERE screenVisible = 0;

-- Saved display setups on the DM screen (location + spotlight). Keys as in DMScreenState.
CREATE TABLE Scene (
  id text PRIMARY KEY NOT NULL, name text NOT NULL, sortOrder integer NOT NULL,
  locationId text, locationHidden integer NOT NULL DEFAULT 0,
  spotlightIds text NOT NULL DEFAULT '[]', hiddenIds text NOT NULL DEFAULT '[]', focusIds text NOT NULL DEFAULT '[]',
  npcsHidden integer NOT NULL DEFAULT 0, createdAt text NOT NULL, updatedAt text NOT NULL
);
