-- Facts Brain Phase 3b: expand staple card_strategy_weights coverage
-- Roles: Starter / Extender / Hand Trap / Board Breaker / Endboard / Lock / Bait
-- Safe re-run via ON CONFLICT update. Unknown card names are skipped by JOIN.

INSERT INTO archetype_strategies (archetype_name, format, primary_strategy, secondary_strategy)
SELECT v.archetype_name, f.format, v.primary_strategy::yugioh_play_strategy, v.secondary_strategy::yugioh_play_strategy
FROM (
  VALUES
    ('Resonator', 'Combo', 'Midrange / Hybrid'),
    ('Red Dragon Archfiend', 'Combo', NULL),
    ('Lair of Darkness', 'Control', 'Combo'),
    ('Fiendsmith', 'Combo', 'Midrange / Hybrid'),
    ('Yummy', 'Combo', NULL),
    ('Mitsurugi', 'Combo', NULL)
) AS v(archetype_name, primary_strategy, secondary_strategy)
CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL')) AS f(format)
ON CONFLICT (archetype_name, format) DO UPDATE
SET
  primary_strategy = EXCLUDED.primary_strategy,
  secondary_strategy = EXCLUDED.secondary_strategy;

INSERT INTO card_strategy_weights (card_id, format, strategy, role, synergy_weight, is_boss)
SELECT c.id::text, f.format, v.strategy::yugioh_play_strategy, v.role::card_role_tag, v.weight, v.is_boss
FROM (
  VALUES
    -- Hand traps / interruptions
    ('Droll & Lock Bird', 'Control', 'Hand Trap', 0.92, false),
    ('Ghost Ogre & Snow Rabbit', 'Control', 'Hand Trap', 0.88, false),
    ('Ghost Belle & Haunted Mansion', 'Control', 'Hand Trap', 0.86, false),
    ('Ghost Mourner & Moonlit Chill', 'Control', 'Hand Trap', 0.82, false),
    ('Skull Meister', 'Control', 'Hand Trap', 0.78, false),
    ('Dimension Shifter', 'Control', 'Hand Trap', 0.90, false),
    ('Fantastical Dragon Phantazmay', 'Control', 'Hand Trap', 0.84, false),
    ('Mulcharmy Fuwaros', 'Control', 'Hand Trap', 0.93, false),
    ('Mulcharmy Purulia', 'Control', 'Hand Trap', 0.93, false),
    ('Mulcharmy Meowls', 'Control', 'Hand Trap', 0.90, false),
    ('Dominus Impulse', 'Control', 'Hand Trap', 0.88, false),
    ('Dominus Purge', 'Control', 'Hand Trap', 0.86, false),

    -- Board breakers / going second
    ('Raigeki', 'Aggro / Beatdown', 'Board Breaker', 0.85, false),
    ('Harpie''s Feather Duster', 'Aggro / Beatdown', 'Board Breaker', 0.90, false),
    ('Triple Tactics Talent', 'Aggro / Beatdown', 'Board Breaker', 0.88, false),
    ('Triple Tactics Thrust', 'Aggro / Beatdown', 'Board Breaker', 0.86, false),
    ('Super Polymerization', 'Aggro / Beatdown', 'Board Breaker', 0.87, false),
    ('Gameciel, the Sea Turtle Kaiju', 'Aggro / Beatdown', 'Board Breaker', 0.84, false),
    ('Interrupted Kaiju Slumber', 'Aggro / Beatdown', 'Board Breaker', 0.80, false),
    ('Ultimate Slayer', 'Aggro / Beatdown', 'Board Breaker', 0.86, false),

    -- Consistency / bait / extenders
    ('Pot of Extravagance', 'Combo', 'Extender', 0.72, false),
    ('Pot of Avarice', 'Combo', 'Extender', 0.65, false),
    ('Upstart Goblin', 'Combo', 'Extender', 0.70, false),
    ('Allure of Darkness', 'Combo', 'Extender', 0.74, false),
    ('Crossout Designator', 'Combo', 'Bait', 0.82, false),
    ('One for One', 'Combo', 'Starter', 0.78, false),
    ('Foolish Burial', 'Combo', 'Starter', 0.76, false),
    ('Reinforcement of the Army', 'Combo', 'Starter', 0.80, false),

    -- Floodgates / locks
    ('Skill Drain', 'Stun / Floodgate', 'Lock', 0.90, false),
    ('Rivalry of Warlords', 'Stun / Floodgate', 'Lock', 0.86, false),
    ('Gozen Match', 'Stun / Floodgate', 'Lock', 0.86, false),
    ('There Can Be Only One', 'Stun / Floodgate', 'Lock', 0.88, false),
    ('Summon Limit', 'Stun / Floodgate', 'Lock', 0.84, false),
    ('Anti-Spell Fragrance', 'Stun / Floodgate', 'Lock', 0.85, false),
    ('Solemn Judgment', 'Control', 'Hand Trap', 0.88, false),
    ('Solemn Strike', 'Control', 'Hand Trap', 0.86, false),

    -- Extra Deck endboard / bosses
    ('Accesscode Talker', 'Combo', 'Endboard', 0.95, true),
    ('Apollousa, Bow of the Goddess', 'Control', 'Endboard', 0.94, true),
    ('Baronne de Fleur', 'Combo', 'Endboard', 0.95, true),
    ('Borreload Savage Dragon', 'Combo', 'Endboard', 0.93, true),
    ('S:P Little Knight', 'Midrange / Hybrid', 'Endboard', 0.92, true),
    ('I:P Masquerena', 'Combo', 'Extender', 0.88, false),
    ('Underworld Goddess of the Closed World', 'Combo', 'Endboard', 0.90, true),
    ('Divine Arsenal AA-ZEUS - Sky Thunder', 'Aggro / Beatdown', 'Endboard', 0.93, true),
    ('Chaos Angel', 'Combo', 'Endboard', 0.91, true),
    ('Dharc the Dark Charmer, Gloomy', 'Combo', 'Extender', 0.80, false),
    ('Selene, Queen of the Master Magicians', 'Combo', 'Extender', 0.82, false),
    ('Knightmare Unicorn', 'Combo', 'Extender', 0.78, false),
    ('Knightmare Phoenix', 'Combo', 'Extender', 0.76, false)
) AS v(card_name, strategy, role, weight, is_boss)
JOIN cards c ON c.name = v.card_name
CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL')) AS f(format)
ON CONFLICT (card_id, format, strategy, role) DO UPDATE
SET
  synergy_weight = EXCLUDED.synergy_weight,
  is_boss = EXCLUDED.is_boss;
