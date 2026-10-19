-- The DM screen can hide the current location and individual spotlight NPCs from the player
-- display without removing them. Both start visible; the old release ignores the columns.
ALTER TABLE DMScreenState ADD COLUMN locationHidden integer NOT NULL DEFAULT 0;
ALTER TABLE DMScreenState ADD COLUMN hiddenNpcIds text NOT NULL DEFAULT '[]';
