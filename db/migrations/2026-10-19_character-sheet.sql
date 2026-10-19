-- Character sheet from D&D Beyond (saves, skills, AC, attacks, features, inventory) as JSON,
-- written by every full sync. Private parts are filtered per viewer in the app. The old release ignores it.
ALTER TABLE Character ADD COLUMN sheet text;
