// Playlist access rules. Pure: no DB imports.
export type Viewer = { id: string; role: string } | null;
type Playlist = { ownerId: string; visibility: string; isSiteDefault: boolean };

export function canView(p: Playlist, viewer: Viewer): boolean {
  if (p.isSiteDefault) return true;
  if (!viewer) return false;
  if (viewer.role === 'admin' || viewer.id === p.ownerId) return true;
  return p.visibility === 'public';
}

export function canEdit(p: Playlist, viewer: Viewer): boolean {
  if (!viewer) return false;
  if (viewer.role === 'admin') return true;
  if (p.isSiteDefault) return viewer.role === 'dungeonmaster';
  return viewer.id === p.ownerId;
}

export function canSetSiteDefault(viewer: Viewer): boolean {
  return !!viewer && viewer.role === 'admin';
}
