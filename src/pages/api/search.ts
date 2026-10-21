import type { APIRoute } from 'astro';
import { getUserRole } from '../../lib/auth';
import { search, MIN_QUERY, type Viewer } from '../../lib/search';
import { COMMANDS } from '../../lib/search/commands';
import { loadRecords } from '../../lib/search/sources';

// Global search (⌘K). Open to everyone; what comes back depends on the role (see sources.ts).

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ url, cookies }) => {
  const q = (url.searchParams.get('q') ?? '').slice(0, 200);
  if (q.trim().length < MIN_QUERY) return json({ groups: [] });
  try {
    const viewer = (await getUserRole(cookies)) as Viewer;
    const records = [...COMMANDS, ...(await loadRecords(viewer))];
    return json({ groups: search(q, records, viewer) });
  } catch (error) {
    console.error('Error searching:', error);
    return json({ error: 'Search failed' }, 500);
  }
};
