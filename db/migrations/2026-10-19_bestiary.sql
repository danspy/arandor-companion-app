-- Bestiary (DM only): stat blocks for monsters and NPCs, and the link from an initiative entry
-- to the stat block it was added from. The old release ignores both.
CREATE TABLE IF NOT EXISTS Creature (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  typeLine text,
  ac integer,
  acNote text,
  hp integer,
  hpFormula text,
  initiative integer,
  speed text,
  abilities text NOT NULL DEFAULT '{}',
  details text NOT NULL DEFAULT '[]',
  sections text NOT NULL DEFAULT '[]',
  cr text,
  xp integer,
  npcIds text NOT NULL DEFAULT '[]',
  notes text,
  sourceText text,
  srdKey text,
  createdAt text NOT NULL,
  updatedAt text NOT NULL
);
ALTER TABLE InitiativeTracker ADD COLUMN creatureId text;
