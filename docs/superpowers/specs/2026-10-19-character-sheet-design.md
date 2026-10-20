# Character sheet on the character page: design (2026-10-19)

Agreed with the user in chat. Builds on PR #198 (one D&D Beyond implementation in
`src/lib/dndbeyond.ts`, checked against the real sheets).

## Goal

The character page becomes a usable sheet at the table: every modifier is a roll button that
throws the shared 3D dice, and the numbers are the ones D&D Beyond shows.

## Decisions

| Question | Decision |
|---|---|
| Scope | Core rolls + combat strip, skills, attacks & spells, features & inventory |
| Visibility | **Public:** ability scores, ability checks, saving throws, combat strip (HP, AC, initiative, speed, proficiency bonus, passive Perception). **Private** (the character's player, the DM role and admins): skills, attacks & spells, spell DC/attack, features & traits, inventory |
| Source of numbers | Calculated from D&D Beyond's character JSON at sync time (not a headless browser) |
| Storage | One JSON column `Character.sheet` (nullable), written by every full sync (button, daily auto-sync, import). The combat HP sync stays HP-only |
| Accuracy | Each number is tested against the rendered D&D Beyond sheet of all 7 linked characters. A value the code cannot match reliably (e.g. an unusual attack) is left out instead of shown wrong |
| Rolls | Through `rollParts` (3D dice, history, crit doubling). Named `"<Character> · <what>"`. Adv/Dis toggle for the next d20, like the bestiary stat block |
| Characters without D&D Beyond | Ability checks and plain saving throws from the stored scores; the other sections are hidden |

## Data: `CharacterSheet` (stored in `Character.sheet`)

```ts
interface CharacterSheet {
  version: 1;
  // public
  proficiencyBonus: number;
  ac: number;
  initiative: number;           // bonus
  speed: number;                // walking, ft
  passivePerception: number;
  saves: Record<Ability, { bonus: number; proficient: boolean }>;
  // private
  passiveInvestigation: number;
  passiveInsight: number;
  skills: { key: string; name: string; ability: Ability; bonus: number;
            proficiency: 'none' | 'half' | 'proficient' | 'expertise' }[];
  spellcasting: { className: string; ability: Ability; saveDc: number; attack: number }[];
  attacks: { name: string; kind: 'weapon' | 'spell' | 'unarmed'; range: string;
             toHit: number | null; saveDc: number | null; damage: string | null;
             damageType: string | null; notes: string }[];
  features: { name: string; source: string; description: string }[];   // plain text, shortened
  inventory: { name: string; quantity: number; equipped: boolean; attuned: boolean }[];
}
```

`publicSheet(sheet)` returns only the public keys. `src/lib/character-sheet.ts` holds the
type, `publicSheet` and `canSeePrivateSheet(user, role, character)` (owner, `dungeonmaster`, `admin`;
legacy ownership via `User.characterIds` counts as owner, like the existing edit check).

## Calculation (`src/lib/dndbeyond.ts`, pure, `buildSheet(data)`)

- Proficiency bonus from total level. Saves/skills: `proficiency` / `expertise` /
  `half-proficiency` modifiers (and Jack of All Trades via its modifier), plus bonus modifiers
  (`saving-throws`, `ability-checks`, per skill).
- Passive = 10 + skill bonus (+ passive bonus modifiers).
- Initiative = DEX mod + `initiative` bonuses (+ proficiency where a modifier grants it).
- AC: equipped armor (light: + DEX, medium: + DEX max 2, heavy: none) or unarmored
  (10 + DEX, or the class's unarmored defense via `set` / `unarmored-armor-class` modifiers),
  + shield, + item/feature `armor-class` bonuses, `overrideArmorClass` wins.
- Speed: race walking speed + `speed` bonuses (`unarmored-movement` for Monk etc.).
- Attacks: equipped weapons (finesse/ranged/Martial Arts ability choice, magic bonus,
  proficiency), unarmed strike, and spells that have an attack roll or save and damage dice.
- Features: class features up to the current level, species traits, feats; descriptions stripped
  of HTML and cut to ~300 characters.

## Page (`src/pages/characters/[id].astro`)

- Combat strip under the hero (HP bar from `hp`/`maxHp`; AC; initiative as a roll button; speed;
  proficiency; passive Perception).
- Ability cards: the modifier button rolls `1d20±mod` ("Strength check"); a save row under it
  rolls the save, with a dot for proficiency.
- Private sections render only when `canSeePrivateSheet` is true: Skills grid (button per skill),
  Attacks & spells (to-hit button and damage button per row; spell DC shown as text),
  Features & traits (collapsible `<details>`), Inventory (equipped first, attunement mark).
- Roll wiring in `src/lib/character-rolls.ts`: delegated click handler on `[data-roll]`
  buttons (`data-roll="1d20+5"`, `data-roll-name="Stealth"`), mode toggle; bound once,
  works across ClientRouter swaps.

## Privacy

- Private data is not rendered into the HTML for other viewers.
- `GET /api/characters/[id]`: `sheet` passed through `publicSheet` unless the viewer may see it.
- `GET /api/characters` (list) and every other place that sends character rows to the browser
  leave `sheet` out entirely.
- The sync endpoints return the full row only to who may sync (owner/admin) — unchanged.

## Migration

`db/migrations/2026-10-19_character-sheet.sql`: `ALTER TABLE Character ADD COLUMN sheet text;`
Dev now; preview and live only after the user approves the merge (per deploy/README.md). The old
release ignores the column.

## Testing

- `e2e/dndbeyond.spec.ts`: fixtures extended with the fields `buildSheet` reads; expected values
  (saves, skills, passives, initiative, AC, speed, attacks) taken from the captured D&D Beyond
  pages of all 7 characters.
- `e2e/character-sheet.spec.ts` (logged-in, isolated server): a visitor sees the public sections
  and no skills/attacks in the HTML or the API; the owner/DM sees them; clicking a modifier
  produces a roll record with the expected expression.
- Docs: `docs/DnD-Beyond-Sync.md` (what is synced, visibility) and the characters page docs.
