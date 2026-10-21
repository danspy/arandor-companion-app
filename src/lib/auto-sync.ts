// Browser side of the automatic D&D Beyond sync (/api/characters/auto-sync): ask the server to
// refresh the given characters (it skips ones synced in the last 15 minutes) and, if any of them
// changed, refresh the page once — softly, so music keeps playing — but only if the reader is
// still on it: a refresh after they moved on would land on the next page instead. Never while a
// form on the page has unsaved edits ([data-unsaved], e.g. character notes): those would be lost.
// A page that can refresh just the synced part (the DM screen's party panel) passes `refresh`.
export async function autoSyncCharacters(ids: string[], refresh: () => Promise<void> = () => window.arandorSoftReload()): Promise<void> {
  if (!ids.length) return;
  const page = document.querySelector('main');
  const results = await Promise.allSettled(ids.map((characterId) =>
    fetch('/api/characters/auto-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId }),
    }).then((response) => response.json())
  ));
  const changed = results.some((r) => r.status === 'fulfilled' && r.value.success && r.value.updated);
  if (changed && page?.isConnected && !document.querySelector('[data-unsaved]')) await refresh();
}

// Also on window, for inline scripts (define:vars) that cannot import.
declare global {
  interface Window { arandorAutoSyncCharacters: typeof autoSyncCharacters }
}
window.arandorAutoSyncCharacters = autoSyncCharacters;
