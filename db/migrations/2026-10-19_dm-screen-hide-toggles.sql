-- The DM screen can hide the current location, individual spotlight NPCs, or all spotlight NPCs
-- at once from the player display without removing them. Everything starts visible; the old
-- release ignores the columns.
ALTER TABLE DMScreenState ADD COLUMN locationHidden integer NOT NULL DEFAULT 0;
ALTER TABLE DMScreenState ADD COLUMN hiddenNpcIds text NOT NULL DEFAULT '[]';
ALTER TABLE DMScreenState ADD COLUMN npcsHidden integer NOT NULL DEFAULT 0;
