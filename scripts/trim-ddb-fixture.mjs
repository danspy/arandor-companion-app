// Shrinks a D&D Beyond character JSON (character-service v5) to a test fixture:
// keeps the fields the import reads, cuts long texts, drops the rest.
// Usage: node scripts/trim-ddb-fixture.mjs <raw.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';

const DROP_TOP = ['campaign', 'notes', 'creatures', 'readonlyUrl', 'username', 'userId', 'socialName', 'currencies', 'preferences', 'configuration', 'activeSourceCategories'];
const DROP_ANY = ['sources', 'prerequisites', 'avatarUrl', 'largeAvatarUrl', 'portraitAvatarUrl', 'moreDetailsUrl', 'forumUrl', 'portraitAvatarUrl', 'backdropAvatarUrl', 'smallBackdropAvatarUrl', 'largeBackdropAvatarUrl', 'thumbnailBackdropAvatarUrl', 'groupedImages', 'creatureRules', 'levelSpells', 'spellListIds', 'infusionActions', 'tags', 'sourceSort', 'definitionKey'];
const MAX_TEXT = 240;

const trim = (v) => {
  if (typeof v === 'string') return v.length > MAX_TEXT ? v.slice(0, MAX_TEXT) : v;
  if (Array.isArray(v)) return v.map(trim);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (!DROP_ANY.includes(k)) out[k] = trim(x);
    return out;
  }
  return v;
};

const [, , src, dest] = process.argv;
const raw = JSON.parse(readFileSync(src, 'utf8'));
const data = { ...raw.data };
for (const k of DROP_TOP) delete data[k];
if (data.choices) delete data.choices.choiceDefinitions; // every option the builder offered
const avatar = data.decorations?.avatarUrl;
data.decorations = avatar ? { avatarUrl: avatar } : null;
writeFileSync(dest, JSON.stringify({ data: trim(data) }));
