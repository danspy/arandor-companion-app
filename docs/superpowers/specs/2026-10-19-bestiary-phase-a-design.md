# Bestiary, phase A: design (2026-10-19)

Agreed with the DM in chat; implemented in the PR that adds this file. User-facing behaviour is
documented in `docs/DM-Tools.md#bestiary`.

## Goal

The DM keeps stat blocks for monsters and named NPCs, adds them to a fight in one step, reads
them next to the fight, and rolls everything in them with the shared dice engine. Damage and
healing in the tracker make fights faster.

## Decisions

| Question | Decision |
|---|---|
| Source of stat blocks | Paste text from D&D Beyond, **2024 Monster Manual layout**; homebrew via the same form |
| Storage | **A: numbers as columns, descriptions as text.** Traits/actions/… keep their wording; roll buttons are found in the text when shown (`findRolls`), so an odd line never loses information |
| Access | DM/admin only (pages and `/api/creatures`, reading included). Players never get stat blocks; `creatureId` is not part of the redacted tracker view |
| NPC link | `Creature.npcIds` (the NPC record is public, so the link lives on the DM-only side) |
| HP when adding | Average from the stat block, overridable per batch |
| Initiative when adding | d20 + bonus per copy, shown and editable before adding |
| Damage/heal | In phase A: temp HP first, floor 0, heal to max and clear death saves; DM on all, players on their own characters (character record follows) |
| Critical hits | Attack name button rolls to hit + unconditional damage; a natural 20 throws the damage dice again (dice engine) |

## Units

- `src/lib/statblock.ts`: types, `importStatBlock` (paste parser), `validateCreature` (API),
  `findRolls` / `attackParts` (rolls in text), `nextCopyNumbers`. Pure.
- `src/lib/hp.ts`: `applyHpChange`. Pure.
- `src/lib/statblock-view.ts`: renders a stat block with roll buttons (page, panel, preview).
- `src/lib/statblock-panel.ts`: the side panel (tracker, DM screen).
- `src/lib/quick-add.ts`: the "Add to initiative" dialog.
- `src/components/CreatureEditor.astro`: paste + form + live preview.
- API: `/api/creatures`, `/api/creatures/[id]`, `/api/initiative/[id]/hp`; `creatureId` on
  initiative POST/PUT (PUT keeps it when not sent).
- Migration: `db/migrations/2026-10-19_bestiary.sql` (`Creature` table,
  `InitiativeTracker.creatureId`).

## Added after the first review (same PR)

- Damage/heal on the DM screen's turn preview and in the stat block panel (`lib/hp-control.ts`).
- **SRD 5.2 library:** `scripts/import-srd.mjs` converts the 331 SRD 5.2 creatures (CC-BY-4.0,
  via Open5e) into `src/data/srd-2024-creatures.json` (repairs: "Hit:" in attacks, recharge and
  per-day limits in names, "Medium or Small" for generic Humanoids, legendary intro; garbled
  ability scores are left out with a note). Fights use the DM's own copy (`Creature.srdKey`).
- **Generator** (`lib/npc-generator.ts`): 9 SRD species × 6 roles × level 1–20 with the 2024
  player rules; saved as an ordinary creature.

- **Combatant panel** for every combatant (row click): quick edit via `PATCH /api/initiative/[id]`,
  conditions (`InitiativeTracker.conditions`, `lib/conditions.ts`, visible to players), linking a
  stat block; reopens itself after the reloads a new order needs.

## Later phases

- **B: limited uses.** Per combatant: spell slots, X/Day, recharge state, legendary action and
  resistance counters, reset per round/fight. Attach to the named entries in `sections`.
- **C: imports** from 5etools and Improved Initiative JSON into the same `CreatureData` shape.

## Testing

`e2e/bestiary.spec.ts`: parser on three 2024 fixtures (`e2e/fixtures/statblocks/`), roll
detection, HP arithmetic, validation; on a test server: access rules, no leak to players,
link kept on edit and dropped on delete, and the whole flow (paste → save → roll → quick add →
panel → damage/heal → DM screen). Real pasted stat blocks are the final check.
