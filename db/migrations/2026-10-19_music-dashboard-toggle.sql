-- The site playlist's dashboard panel can be switched off on Tools → Music (admins and DMs).
-- Existing playlists keep showing it; the old release ignores the column.
ALTER TABLE Playlist ADD COLUMN showOnDashboard integer NOT NULL DEFAULT 1;
