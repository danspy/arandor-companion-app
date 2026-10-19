-- Music player: playlists and their tracks, plus the one site playlist "Tavern music" (public,
-- owned by the oldest admin). Only adds tables; the old release ignores them.
CREATE TABLE IF NOT EXISTS Playlist (
  id text PRIMARY KEY NOT NULL,
  ownerId text NOT NULL,
  name text NOT NULL,
  visibility text NOT NULL DEFAULT 'private',
  isSiteDefault integer NOT NULL DEFAULT 0,
  createdAt text NOT NULL,
  updatedAt text NOT NULL
);

CREATE TABLE IF NOT EXISTS PlaylistTrack (
  id text PRIMARY KEY NOT NULL,
  playlistId text NOT NULL,
  position integer NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  ref text NOT NULL,
  durationSec integer,
  createdAt text NOT NULL,
  FOREIGN KEY (playlistId) REFERENCES Playlist(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS Playlist_one_site ON Playlist(isSiteDefault) WHERE isSiteDefault = 1;
CREATE INDEX IF NOT EXISTS PlaylistTrack_playlist ON PlaylistTrack(playlistId, position);

INSERT INTO Playlist (id, ownerId, name, visibility, isSiteDefault, createdAt, updatedAt)
SELECT lower(hex(randomblob(16))),
       (SELECT id FROM User WHERE role = 'admin' ORDER BY createdAt LIMIT 1),
       'Tavern music', 'public', 1,
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM Playlist WHERE isSiteDefault = 1)
  AND EXISTS (SELECT 1 FROM User WHERE role = 'admin');
