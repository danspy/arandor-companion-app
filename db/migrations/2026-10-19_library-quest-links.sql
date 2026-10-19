-- Library entries can be linked to quests (JSON array of Quest ids, like DiaryEntry.questIds).
-- Existing entries start with no quests; the old release ignores the column.
ALTER TABLE LibraryEntry ADD COLUMN questIds text DEFAULT '[]' NOT NULL;
