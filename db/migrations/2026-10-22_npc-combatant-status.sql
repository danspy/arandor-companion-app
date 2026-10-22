-- From now on a named NPC and its combatants in the initiative tracker (same name, not a party
-- character) share one HP and one set of conditions (lib/npc-combatants). Pairs that drifted
-- apart before become one: the combatant's HP win where it has some (the fight is the latest),
-- the conditions of both are kept (the NPC's first). Data only, no schema change; running it
-- again changes no HP or conditions.
UPDATE NPC SET
  hp = COALESCE((SELECT t.hp FROM InitiativeTracker t
                 WHERE trim(t.name) = trim(NPC.name) AND t.type != 'character' AND t.hp IS NOT NULL
                 ORDER BY t.updatedAt DESC LIMIT 1), hp),
  maxHp = COALESCE((SELECT t.maxHp FROM InitiativeTracker t
                    WHERE trim(t.name) = trim(NPC.name) AND t.type != 'character' AND t.hp IS NOT NULL
                    ORDER BY t.updatedAt DESC LIMIT 1), maxHp),
  conditions = (SELECT json_group_array(value) FROM (
                  SELECT value, min(ord) AS ord FROM (
                    SELECT j.value AS value, j.key AS ord FROM json_each(NPC.conditions) j
                    UNION ALL
                    SELECT j.value, 100 + j.key FROM InitiativeTracker t, json_each(t.conditions) j
                    WHERE trim(t.name) = trim(NPC.name) AND t.type != 'character')
                  GROUP BY value ORDER BY ord)),
  updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (SELECT 1 FROM InitiativeTracker t WHERE trim(t.name) = trim(NPC.name) AND t.type != 'character');

UPDATE InitiativeTracker SET
  hp = (SELECT n.hp FROM NPC n WHERE trim(n.name) = trim(InitiativeTracker.name) LIMIT 1),
  maxHp = (SELECT n.maxHp FROM NPC n WHERE trim(n.name) = trim(InitiativeTracker.name) LIMIT 1),
  conditions = (SELECT n.conditions FROM NPC n WHERE trim(n.name) = trim(InitiativeTracker.name) LIMIT 1),
  updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE type != 'character' AND EXISTS (SELECT 1 FROM NPC n WHERE trim(n.name) = trim(InitiativeTracker.name));
