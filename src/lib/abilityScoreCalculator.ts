/**
 * Calculate ability scores from D&D Beyond character data
 * Since the API doesn't expose bonuses, we calculate them from feats, race, etc.
 */

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface CalculationLog {
  stat: string;
  source: string;
  bonus: number;
  reason: string;
}

/**
 * Calculate final ability scores from character data
 */
export function calculateAbilityScores(data: any): { scores: AbilityScores; log: CalculationLog[] } {
  const log: CalculationLog[] = [];
  
  // Start with base stats
  const stats = data.data?.stats || [];
  const scores: AbilityScores = {
    strength: stats.find((s: any) => s.id === 1)?.value || 10,
    dexterity: stats.find((s: any) => s.id === 2)?.value || 10,
    constitution: stats.find((s: any) => s.id === 3)?.value || 10,
    intelligence: stats.find((s: any) => s.id === 4)?.value || 10,
    wisdom: stats.find((s: any) => s.id === 5)?.value || 10,
    charisma: stats.find((s: any) => s.id === 6)?.value || 10,
  };
  
  log.push({
    stat: 'all',
    source: 'base',
    bonus: 0,
    reason: `Base scores: STR ${scores.strength}, DEX ${scores.dexterity}, CON ${scores.constitution}, INT ${scores.intelligence}, WIS ${scores.wisdom}, CHA ${scores.charisma}`,
  });
  
  // Apply override stats (these are manually set and take precedence)
  const overrideStats = data.data?.overrideStats || [];
  overrideStats.forEach((override: any) => {
    if (override.value !== null && override.value !== undefined) {
      const statNames = ['', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
      const statName = statNames[override.id] as keyof AbilityScores;
      if (statName) {
        const oldValue = scores[statName];
        scores[statName] = override.value;
        log.push({
          stat: statName,
          source: 'override',
          bonus: override.value - oldValue,
          reason: `Manual override set ${statName.toUpperCase()} to ${override.value}`,
        });
      }
    }
  });
  
  // Apply racial bonuses
  applyRacialBonuses(scores, data, log);
  
  // Apply feat bonuses
  applyFeatBonuses(scores, data, log);
  
  // Apply ASI bonuses from leveling
  applyASIBonuses(scores, data, log);
  
  // Apply magic item bonuses
  applyMagicItemBonuses(scores, data, log);
  
  // Cap at 20 (or 30 with certain magic items)
  Object.keys(scores).forEach((key) => {
    const statKey = key as keyof AbilityScores;
    if (scores[statKey] > 20) {
      log.push({
        stat: statKey,
        source: 'cap',
        bonus: 0,
        reason: `Capped ${statKey.toUpperCase()} at 20 (was ${scores[statKey]})`,
      });
      scores[statKey] = 20;
    }
  });
  
  return { scores, log };
}

/**
 * Apply racial ability score bonuses
 */
function applyRacialBonuses(scores: AbilityScores, data: any, log: CalculationLog[]): void {
  const race = data.data?.race;
  if (!race) return;
  
  const raceName = race.fullName || race.baseName || '';
  const racialTraits = race.racialTraits || [];
  
  // Check for Tasha's flexible ASI (2021+ races)
  const hasFlexibleASI = racialTraits.some((trait: any) => 
    trait.definition?.name?.includes('Ability Score Increase') &&
    trait.definition?.categories?.some((cat: any) => cat.tagName === '__INITIAL_ASI')
  );
  
  if (hasFlexibleASI) {
    log.push({
      stat: 'all',
      source: 'race',
      bonus: 0,
      reason: `${raceName} has Tasha's flexible ASI - cannot determine allocation without choice data`,
    });
    return;
  }
  
  // Fixed racial bonuses (pre-Tasha's races)
  const racialBonuses: { [key: string]: Partial<AbilityScores> } = {
    'Mountain Dwarf': { strength: 2, constitution: 2 },
    'Hill Dwarf': { constitution: 2, wisdom: 1 },
    'High Elf': { dexterity: 2, intelligence: 1 },
    'Wood Elf': { dexterity: 2, wisdom: 1 },
    'Dark Elf (Drow)': { dexterity: 2, charisma: 1 },
    'Lightfoot Halfling': { dexterity: 2, charisma: 1 },
    'Stout Halfling': { dexterity: 2, constitution: 1 },
    'Human': { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
    'Dragonborn': { strength: 2, charisma: 1 },
    'Gnome': { intelligence: 2 },
    'Forest Gnome': { intelligence: 2, dexterity: 1 },
    'Rock Gnome': { intelligence: 2, constitution: 1 },
    'Half-Elf': { charisma: 2 }, // Plus 2 points to distribute
    'Half-Orc': { strength: 2, constitution: 1 },
    'Tiefling': { charisma: 2, intelligence: 1 },
  };
  
  const bonuses = racialBonuses[raceName];
  if (bonuses) {
    Object.entries(bonuses).forEach(([stat, bonus]) => {
      const statKey = stat as keyof AbilityScores;
      scores[statKey] += bonus;
      log.push({
        stat: statKey,
        source: 'race',
        bonus,
        reason: `${raceName} racial bonus: +${bonus} ${statKey.toUpperCase()}`,
      });
    });
  } else {
    log.push({
      stat: 'all',
      source: 'race',
      bonus: 0,
      reason: `Unknown race bonuses for: ${raceName}`,
    });
  }
}

/**
 * Apply feat ability score bonuses
 */
function applyFeatBonuses(scores: AbilityScores, data: any, log: CalculationLog[]): void {
  const feats = data.data?.feats || [];
  const classes = data.data?.classes || [];
  
  // Determine primary spellcasting ability for flexible feat choices
  const primarySpellcaster = classes.find((c: any) => 
    ['Wizard', 'Sorcerer', 'Warlock', 'Bard', 'Cleric', 'Druid'].includes(c.definition?.name)
  );
  const spellcastingAbility = getSpellcastingAbility(primarySpellcaster?.definition?.name);
  
  feats.forEach((feat: any) => {
    const featName = feat.definition?.name || '';
    const featDesc = feat.definition?.description || '';
    
    // Deterministic feats (always the same bonus)
    if (featName === 'Keen Mind') {
      scores.intelligence += 1;
      log.push({
        stat: 'intelligence',
        source: 'feat',
        bonus: 1,
        reason: `Keen Mind feat: +1 INT`,
      });
    }
    
    // Feats with choices - use heuristics
    else if (featName === 'Lightly Armored') {
      // Prefer DEX for light armor users
      const usesDex = classes.some((c: any) => 
        ['Rogue', 'Monk', 'Ranger'].includes(c.definition?.name)
      );
      const chosenStat = usesDex ? 'dexterity' : 'strength';
      scores[chosenStat] += 1;
      log.push({
        stat: chosenStat,
        source: 'feat',
        bonus: 1,
        reason: `Lightly Armored feat: +1 ${chosenStat.toUpperCase()} (heuristic: ${usesDex ? 'DEX-based class' : 'default STR'})`,
      });
    }
    
    else if (featName === 'Observant') {
      // Prefer spellcasting ability or WIS
      const chosenStat = (spellcastingAbility === 'intelligence' || spellcastingAbility === 'wisdom') 
        ? spellcastingAbility 
        : 'wisdom';
      scores[chosenStat] += 1;
      log.push({
        stat: chosenStat,
        source: 'feat',
        bonus: 1,
        reason: `Observant feat: +1 ${chosenStat.toUpperCase()} (heuristic: spellcasting ability)`,
      });
    }
    
    else if (featName === 'Fey Touched' || featName === 'Shadow Touched' || featName === 'Telepathic' || featName === 'Telekinetic') {
      // Prefer spellcasting ability
      const chosenStat = spellcastingAbility || 'charisma';
      scores[chosenStat] += 1;
      log.push({
        stat: chosenStat,
        source: 'feat',
        bonus: 1,
        reason: `${featName} feat: +1 ${chosenStat.toUpperCase()} (heuristic: spellcasting ability)`,
      });
    }
    
    else if (featName === 'Resilient') {
      log.push({
        stat: 'unknown',
        source: 'feat',
        bonus: 1,
        reason: `Resilient feat: +1 to unknown stat (choice not available)`,
      });
    }
    
    else if (featName === 'Athlete') {
      // Prefer STR for melee classes
      const useStr = classes.some((c: any) => 
        ['Fighter', 'Barbarian', 'Paladin'].includes(c.definition?.name)
      );
      const chosenStat = useStr ? 'strength' : 'dexterity';
      scores[chosenStat] += 1;
      log.push({
        stat: chosenStat,
        source: 'feat',
        bonus: 1,
        reason: `Athlete feat: +1 ${chosenStat.toUpperCase()} (heuristic: ${useStr ? 'STR-based class' : 'default DEX'})`,
      });
    }
    
    // Check if feat grants ASI (Ability Score Improvement)
    else if (featName === 'Ability Score Improvement') {
      log.push({
        stat: 'unknown',
        source: 'ASI',
        bonus: 2,
        reason: `ASI: +2 total to unknown stats (choice not available)`,
      });
    }
  });
}

/**
 * Apply ASI bonuses from class leveling
 */
function applyASIBonuses(scores: AbilityScores, data: any, log: CalculationLog[]): void {
  const classes = data.data?.classes || [];
  const feats = data.data?.feats || [];
  
  // Count ASI feats already processed
  const asiFeatCount = feats.filter((f: any) => 
    f.definition?.name === 'Ability Score Improvement'
  ).length;
  
  // ASI levels for standard classes (4, 8, 12, 16, 19)
  // Fighters get extra at 6, 14
  let expectedASIs = 0;
  classes.forEach((cls: any) => {
    const level = cls.level || 0;
    const className = cls.definition?.name || '';
    
    if (className === 'Fighter') {
      if (level >= 19) expectedASIs += 7;
      else if (level >= 16) expectedASIs += 6;
      else if (level >= 14) expectedASIs += 5;
      else if (level >= 12) expectedASIs += 4;
      else if (level >= 8) expectedASIs += 3;
      else if (level >= 6) expectedASIs += 2;
      else if (level >= 4) expectedASIs += 1;
    } else if (className === 'Rogue') {
      // Rogues get an extra ASI at 10
      if (level >= 19) expectedASIs += 6;
      else if (level >= 16) expectedASIs += 5;
      else if (level >= 12) expectedASIs += 4;
      else if (level >= 10) expectedASIs += 3;
      else if (level >= 8) expectedASIs += 2;
      else if (level >= 4) expectedASIs += 1;
    } else {
      // Standard progression
      if (level >= 19) expectedASIs += 5;
      else if (level >= 16) expectedASIs += 4;
      else if (level >= 12) expectedASIs += 3;
      else if (level >= 8) expectedASIs += 2;
      else if (level >= 4) expectedASIs += 1;
    }
  });
  
  if (expectedASIs > asiFeatCount) {
    log.push({
      stat: 'unknown',
      source: 'ASI',
      bonus: (expectedASIs - asiFeatCount) * 2,
      reason: `Expected ${expectedASIs} ASIs from levels, found ${asiFeatCount} ASI feats. Missing: ${expectedASIs - asiFeatCount} ASIs (+${(expectedASIs - asiFeatCount) * 2} total points)`,
    });
  }
}

/**
 * Apply magic item ability score bonuses
 */
function applyMagicItemBonuses(scores: AbilityScores, data: any, log: CalculationLog[]): void {
  const inventory = data.data?.inventory || [];
  
  inventory.forEach((item: any) => {
    if (!item.equipped) return;
    
    const itemName = item.definition?.name || '';
    
    // Items that set stats to specific values
    if (itemName.includes('Headband of Intellect')) {
      if (scores.intelligence < 19) {
        const bonus = 19 - scores.intelligence;
        scores.intelligence = 19;
        log.push({
          stat: 'intelligence',
          source: 'magic-item',
          bonus,
          reason: `Headband of Intellect: sets INT to 19`,
        });
      }
    } else if (itemName.includes('Gauntlets of Ogre Power')) {
      if (scores.strength < 19) {
        const bonus = 19 - scores.strength;
        scores.strength = 19;
        log.push({
          stat: 'strength',
          source: 'magic-item',
          bonus,
          reason: `Gauntlets of Ogre Power: sets STR to 19`,
        });
      }
    } else if (itemName.includes('Amulet of Health')) {
      if (scores.constitution < 19) {
        const bonus = 19 - scores.constitution;
        scores.constitution = 19;
        log.push({
          stat: 'constitution',
          source: 'magic-item',
          bonus,
          reason: `Amulet of Health: sets CON to 19`,
        });
      }
    }
    // Belt of Giant Strength variants
    else if (itemName.includes('Belt of')) {
      if (itemName.includes('Hill Giant')) {
        if (scores.strength < 21) {
          const bonus = 21 - scores.strength;
          scores.strength = 21;
          log.push({
            stat: 'strength',
            source: 'magic-item',
            bonus,
            reason: `Belt of Hill Giant Strength: sets STR to 21`,
          });
        }
      }
      // Add more belt variants as needed
    }
  });
}

/**
 * Get spellcasting ability for a class
 */
function getSpellcastingAbility(className: string | undefined): keyof AbilityScores | null {
  if (!className) return null;
  
  const spellcasters: { [key: string]: keyof AbilityScores } = {
    'Wizard': 'intelligence',
    'Artificer': 'intelligence',
    'Sorcerer': 'charisma',
    'Warlock': 'charisma',
    'Bard': 'charisma',
    'Paladin': 'charisma',
    'Cleric': 'wisdom',
    'Druid': 'wisdom',
    'Ranger': 'wisdom',
    'Monk': 'wisdom',
  };
  
  return spellcasters[className] || null;
}
