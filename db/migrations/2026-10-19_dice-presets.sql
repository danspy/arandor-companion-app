-- Each user's saved dice rolls ("Longsword: To hit 1d20+5, Slashing 1d8+3"), as a JSON list of
-- { id, name, parts: [{ label, expr }] }. Everyone starts with none; the old release ignores it.
ALTER TABLE User ADD COLUMN dicePresets text NOT NULL DEFAULT '[]';
