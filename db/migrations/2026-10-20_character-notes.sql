-- Private notes per character (player, DM and admins) on the character page.
-- Only adds a table; the old release ignores it.
CREATE TABLE IF NOT EXISTS CharacterNote (
  characterId text PRIMARY KEY NOT NULL,
  content text NOT NULL,
  updatedAt text NOT NULL
);
