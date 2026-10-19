// The SRD 5.2 creature library (src/data/srd-2024-creatures.json, built by scripts/import-srd.mjs).
// Server side only: the pages and APIs hand it to DMs; it never goes into a browser bundle.

import data from '../data/srd-2024-creatures.json';
import type { CreatureData } from './statblock';

export type SrdCreature = Omit<CreatureData, 'npcIds' | 'notes' | 'sourceText'> & { key: string; notes: string | null };

export const SRD_ATTRIBUTION =
  'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';

const creatures = (data as { creatures: SrdCreature[] }).creatures;
const byKey = new Map(creatures.map((c) => [c.key, c]));

export const srdCreatures = (): SrdCreature[] => creatures;
export const srdCreature = (key: string): SrdCreature | undefined => byKey.get(key);

/** As a bestiary creature (for copying into the DM's own bestiary). */
export function srdToCreature(c: SrdCreature): CreatureData {
  const { key: _key, notes, ...rest } = c;
  return { ...rest, npcIds: [], notes: [notes, 'From the SRD 5.2 (CC-BY-4.0).'].filter(Boolean).join('\n'), sourceText: null };
}

/** "1/8" → 0.125, for sorting and filtering by CR */
export const crValue = (cr: string | null) => (!cr ? -1 : cr.includes('/') ? Number(cr.split('/')[0]) / Number(cr.split('/')[1]) : Number(cr));
