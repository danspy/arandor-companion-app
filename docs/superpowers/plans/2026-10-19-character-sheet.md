# Character Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The character page shows a D&D Beyond-accurate sheet (saves, skills, AC, attacks, features, inventory) whose modifiers are roll buttons, with private parts visible only to the player, the DM and admins.

**Architecture:** `buildSheet(data)` in `src/lib/dndbeyond.ts` turns D&D Beyond's character JSON into a compact `CharacterSheet`, stored in a new `Character.sheet` JSON column by every full sync. The page renders from it; `src/lib/character-sheet.ts` decides visibility and strips private keys from API responses; `src/lib/character-rolls.ts` wires roll buttons to the existing `rollParts` engine.

**Tech Stack:** Astro 7, Drizzle/SQLite, Playwright (pure-function specs + browser specs), existing dice engine (`src/lib/dice.ts`).

**Spec:** `docs/superpowers/specs/2026-10-19-character-sheet-design.md`

## Global Constraints

- Every number must equal what the D&D Beyond sheet shows for the 7 fixtures (`e2e/fixtures/dndbeyond/expected-sheets.json`, captured from the rendered sheets 2026-10-19). A value that cannot be matched is omitted (`null` / left out of a list), never guessed.
- Public keys: `proficiencyBonus, ac, initiative, speed, passivePerception, saves`. Everything else in `CharacterSheet` is private.
- May see private: owner (`Character.userId`, or legacy `User.characterIds`), role `dungeonmaster`, role `admin`.
- No full page reloads; use `window.arandorSoftReload()` (PR #198).
- Dark-only UI, colour tokens from `src/styles/global.css`; reuse existing `t-*` classes.
- Migration applied to dev only (`/srv/arandor-dev/data/dev.db`, backup to `data/archive/` first); preview/live only after explicit user approval.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013p5WVemFYA4YREyqfY56mZ`.

## Review Focus

- A character synced before this change (`sheet` is null) must render the page exactly as the basic variant (ability checks + plain saves), no errors.
- A visitor (not logged in) calling `GET /api/characters/<id>` or `GET /api/characters` must not receive skills/attacks/features/inventory.
- Hand-edited stats (`statsManuallyEdited`) must still drive the ability check buttons; saves use the sheet's numbers only when the sheet exists.
- Feature descriptions come from D&D Beyond HTML: they must render as plain text (no injected markup).
- Roll buttons must keep working after a soft refresh / ClientRouter navigation (handler bound once, delegated).

---

### Task 1: Richer fixtures

**Files:**
- Create: `scripts/trim-ddb-fixture.mjs`
- Modify: `e2e/fixtures/dndbeyond/*.json` (regenerated)
- Already present: `e2e/fixtures/dndbeyond/expected-sheets.json`

`node scripts/trim-ddb-fixture.mjs <raw.json> <out.json>` keeps every field `buildSheet` reads (HP/stat fields as today, plus `race` (weightSpeeds, racialTraits definitions), `classes[].classFeatures`, `classes[].definition.spellCastingAbilityId`, `inventory[].definition` (type, filterType, armorTypeId, armorClass, damage, damageType, properties, attackType, range, longRange, magic, grantedModifiers, isMonkWeapon), `characterValues`, `customItems`, `actions`, `spells`, `classSpells`, `options`, `choices`, `feats` (definition name/description/snippet), `modifiers`) and drops the rest (descriptions trimmed to 600 chars). Raw JSON is fetched from `https://character-service.dndbeyond.com/character/v5/character/<id>`; ids: moronur 139369565, volrak 155156547, sinatah 88666715, alvar 90818931, roval 94808066, barum 94883302, morrigan 148273694.

- [ ] Write the script; regenerate the 7 fixtures (each < 150 KB).
- [ ] Run `npx playwright test e2e/dndbeyond.spec.ts --project=chromium` → existing HP/score tests still PASS.
- [ ] Commit.

### Task 2: Saves, skills, passives, initiative, proficiency

**Files:**
- Create: `src/lib/character-sheet.ts` (types only in this task)
- Modify: `src/lib/dndbeyond.ts`
- Test: `e2e/dndbeyond.spec.ts`

**Interfaces — Produces:**
- `type Ability = 'str'|'dex'|'con'|'int'|'wis'|'cha'`; `interface CharacterSheet` exactly as in the spec (with `version: 1`).
- `buildSheet(data: any): CharacterSheet` in `dndbeyond.ts` (later tasks fill `ac`, `speed`, `attacks`, `spellcasting`, `features`, `inventory`; until then `ac: 0, speed: 0`, empty lists).

- [ ] **Failing test** `sheet numbers match the D&D Beyond sheet`: for each of the 7 names in `expected-sheets.json`, `buildSheet(load(name))` has `proficiencyBonus === e.prof`, `saves[ab].bonus === e.saves[ab]` for all six, `passivePerception/Investigation/Insight` equal `e.perception/investigation/insight`, `initiative === e.initiative`, and for each skill name in `e.skills` the sheet skill with that `name` has `bonus === e.skills[name]` (18 skills).
- [ ] Run → FAIL (`buildSheet` not exported).
- [ ] Implement. Proficiency `2 + floor((level-1)/4)`. Proficient/expertise/half from modifiers `type: proficiency|expertise|half-proficiency` with `subType` `<ability>-saving-throws` or the skill slug (`sleight-of-hand`); `half-proficiency` with subType `ability-checks` = Jack of All Trades (rounded down) for non-proficient skills; bonuses `type: bonus` for `saving-throws` (all saves — includes Aura of Protection, see Roval +3), `<ability>-saving-throws`, `ability-checks`, skill slug, `passive-<skill>`, `initiative`. Unknown deviations: investigate the fixture's modifiers against the expected value before adding a rule (e.g. Sinatah passive Perception 24).
- [ ] Run → PASS. Commit.

### Task 3: AC and speed

**Files:** Modify `src/lib/dndbeyond.ts`; Test `e2e/dndbeyond.spec.ts`

- [ ] **Failing test** `armor class and speed match`: for all 7, `buildSheet(...).ac === e.ac` and `.speed === e.speed` (Moronur 15/50 unarmored Monk, Roval 22 heavy armor + shield + bonuses, Volrak 15 Barbarian).
- [ ] Run → FAIL.
- [ ] Implement per spec "AC" and "Speed" bullets (equipped armor `armorTypeId` 1 light, 2 medium, 3 heavy, 4 shield; `unarmored-armor-class` bonus modifiers with `statId`; `armor-class` bonuses from active modifiers; `characterValues` typeId for AC override/magic bonus; walking speed from `race.weightSpeeds.normal.walk` + `speed`/`unarmored-movement` bonuses, the latter only without armor).
- [ ] Run → PASS. Commit.

### Task 4: Attacks and spellcasting

**Files:** Modify `src/lib/dndbeyond.ts`; Create `e2e/fixtures/dndbeyond/expected-attacks.json`; Test `e2e/dndbeyond.spec.ts`

`expected-attacks.json` (hand-copied from the captured pages): per character the list `{ name, toHit, damage }` of the weapon, unarmed and spell attack rows on the D&D Beyond Actions tab (e.g. Moronur `Dart +9 1d4+4`, `Moronurs Quarterstaff +12 1d10+7`, `Unarmed Strike +9 1d10+4`; Sinatah `Eldritch Blast +10 1d10+5`, `Chill Touch +10 3d10`) and spell save DC per casting class.

- [ ] **Failing test** `attacks match`: for each expected row, the sheet has an attack with the same `name` whose `toHit` and `damage` (string, normalised `XdY+Z`) are equal; the sheet has no attack whose name is missing from the expected list unless its `toHit` is `null` (omitted values allowed). `spellcasting[].saveDc` equals the expected DC.
- [ ] Run → FAIL.
- [ ] Implement: weapons from equipped inventory (ability STR, finesse = max(STR,DEX), ranged DEX, Monk weapons/unarmed use max(STR,DEX) and the Martial Arts die from the Monk level table 1d6/1d8/1d10/1d12 at levels 1/5/11/17), magic bonus from `grantedModifiers` `bonus/magic`, proficiency when proficient; custom names from `characterValues` (typeId 8); unarmed 1 + STR (Monk: martial arts die). Spells: cantrips/prepared spells with `attackType` or `saveDcAbilityId` and damage dice from `modifiers` with `subType` damage type and `atHigherLevels` cantrip scaling (character level 5/11/17), Agonizing Blast via `modifiers`. Spell save DC 8 + prof + ability mod; attack prof + mod (+ bonus modifiers `spell-save-dc`, `spell-attacks`). Rows not matched by these rules are dropped.
- [ ] Run → PASS. Commit.

### Task 5: Features and inventory

**Files:** Modify `src/lib/dndbeyond.ts`; Test `e2e/dndbeyond.spec.ts`

- [ ] **Failing test** `features and inventory`: Moronur's features include `Stunning Strike` and `Tough` (feat), none has `<` in its description, every description ≤ 300 chars; Alvar's inventory contains `Ring of the Ram` `equipped: true, attuned: true` and `Potion of Healing` `equipped: false`; equipped items come first.
- [ ] Run → FAIL.
- [ ] Implement: class features with `requiredLevel <= class level` (skip "Ability Score Improvement", "Proficiencies", "Hit Points", "Subclass" placeholder rows), species traits, feats; HTML → text (strip tags, decode `&amp; &lt; &gt; &quot; &#39; &nbsp;`), cut to 300 chars at a word boundary + "…". Inventory: name (custom name if set), quantity, equipped, attuned; sort equipped first, then name.
- [ ] Run → PASS. Commit.

### Task 6: Store the sheet, privacy

**Files:**
- Create: `db/migrations/2026-10-19_character-sheet.sql` (`ALTER TABLE Character ADD COLUMN sheet text;` with the usual header comment)
- Modify: `src/db/schema.ts` (`sheet: json('sheet')`), `src/lib/dndbeyond.ts` (`parseDnDBeyondCharacter` adds `sheet: buildSheet(data)`), `src/pages/api/characters/sync.ts` (writes `sheet`), `src/lib/character-sheet.ts`, every API under `src/pages/api` that returns Character rows (`characters/index.ts`, `characters/[id].ts`, `characters/available.ts`, `characters/sync.ts`, `characters/sync-hp.ts`, `display/index.ts`, `initiative/*` that echo characters)
- Test: `e2e/character-sheet.spec.ts`

**Interfaces — Produces** (in `character-sheet.ts`):
- `publicSheet(sheet: CharacterSheet | null): Partial<CharacterSheet> | null`
- `canSeePrivateSheet(character: { id: string; userId: string | null }, user: { id: string; characterIds?: unknown } | null, role: string | null): boolean`
- `forViewer<T extends { sheet?: unknown }>(row: T, canSee: boolean): T` (sheet → full or `publicSheet`) and `withoutSheet<T>(row: T): Omit<T,'sheet'>`

- [ ] **Failing pure test** in `e2e/character-sheet.spec.ts`: `publicSheet` keeps exactly the six public keys; `canSeePrivateSheet` true for owner, legacy owner, `dungeonmaster`, `admin`; false for another player and `null` user.
- [ ] Run → FAIL. Implement. Run → PASS.
- [ ] Back up dev.db to `/srv/arandor-dev/data/archive/`, apply the migration to dev.db, add the schema column.
- [ ] Wire: sync writes `sheet`; `[id].ts` GET uses `forViewer` with the request's user; list/other endpoints use `withoutSheet`.
- [ ] Browser test `visitor gets no private sheet` (isolated server, see deploy memory: copy dev.db, known password for `flo`): after a sync as `flo`, an anonymous `GET /api/characters/<id>` has `sheet.saves` but no `sheet.skills`; `GET /api/characters` rows have no `sheet`.
- [ ] Commit.

### Task 7: Page and roll buttons

**Files:**
- Create: `src/lib/character-rolls.ts`, `src/components/character/CombatStrip.astro`, `src/components/character/AbilityCards.astro`, `src/components/character/PrivateSheet.astro`
- Modify: `src/pages/characters/[id].astro`
- Test: `e2e/character-sheet.spec.ts`

**Interfaces:**
- Buttons: `<button class="cs-roll" data-roll="1d20+5" data-roll-name="Stealth">`; a page-level mode switch `[data-roll-mode]` (Normal / Adv / Dis, next d20 only, then back to Normal — same behaviour as `statblock-view.ts`).
- `wireCharacterRolls(characterName: string): void` — delegated `click` on `document`, bound once (module flag), reads the name from `#character-page[data-character-name]`, calls `rollParts([{ label: name, expr }], { mode, name: \`${character} · ${name}\` })`. Damage buttons pass `data-roll` with the damage expression (mode not applied).

- [ ] **Failing browser test** `owner rolls from the sheet`: as `flo` on Moronur's page, click the Stealth button → the dice history (`getHistory()` via `localStorage`/the banner text) shows a roll named `Moronur · Stealth` with expression `1d20+3`; the Skills, Attacks, Features and Inventory sections are visible. Anonymous: the ability cards and combat strip are visible, the four private sections are absent from the HTML.
- [ ] Run → FAIL.
- [ ] Implement the components (combat strip: HP bar, AC, initiative roll, speed, proficiency, passive Perception; ability cards with check + save buttons and proficiency dot; private sections per spec; features in `<details>`; text rendered via Astro expressions only — no `set:html`). Sheet null → checks from `character.stats`, saves = plain modifiers, strip shows HP only.
- [ ] Run → PASS; check 375 px width screenshot for overflow. Commit.

### Task 8: Docs, full verification, PR

**Files:** Modify `docs/DnD-Beyond-Sync.md` (what the sheet syncs, who sees what), `docs/` characters page doc if present.

- [ ] Run `npx playwright test e2e/dndbeyond.spec.ts e2e/character-sheet.spec.ts --project=chromium` → all PASS; `npm run build` → Complete.
- [ ] Commit, push, open PR (base: `fix/character-hp-and-soft-reload` until #198 merges); dev working tree shows both.
