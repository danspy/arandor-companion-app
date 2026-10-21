-- HP and conditions of NPCs, kept between sessions for the DM screen spotlight (DM/admin only;
-- players never see them). Nothing set yet = null HP and no conditions; the old release ignores
-- the columns.
ALTER TABLE NPC ADD COLUMN hp integer;
ALTER TABLE NPC ADD COLUMN maxHp integer;
-- Conditions, effects and own tags, e.g. ["Poisoned", "Exhaustion 2"] (lib/conditions.ts)
ALTER TABLE NPC ADD COLUMN conditions text NOT NULL DEFAULT '[]';
