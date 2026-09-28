-- Facts Brain Phase 1: seed archetype strategies + staple role weights (TCG + MASTER_DUEL)

INSERT INTO archetype_strategies (archetype_name, format, primary_strategy, secondary_strategy)
SELECT v.archetype_name, f.format, v.primary_strategy::yugioh_play_strategy, v.secondary_strategy::yugioh_play_strategy
FROM (
  VALUES
    ('Branded', 'Midrange / Hybrid', 'Combo'),
    ('Snake-Eye', 'Combo', 'Midrange / Hybrid'),
    ('Kashtira', 'Control', 'Stun / Floodgate'),
    ('Tearlaments', 'Combo', NULL),
    ('Spright', 'Combo', NULL),
    ('Runick', 'Control', NULL),
    ('Purrely', 'Combo', NULL),
    ('Labrynth', 'Control', NULL),
    ('Swordsoul', 'Midrange / Hybrid', NULL),
    ('Mathmech', 'Combo', NULL),
    ('Sky Striker', 'Control', NULL),
    ('Dragon Link', 'Combo', NULL),
    ('Pendulum Magician', 'Combo', NULL),
    ('Eldlich', 'Control', 'Stun / Floodgate'),
    ('Drytron', 'Combo', NULL),
    ('Virtual World', 'Combo', NULL),
    ('Tri-Brigade', 'Midrange / Hybrid', NULL),
    ('Dogmatika', 'Control', NULL),
    ('Floowandereeze', 'Stun / Floodgate', NULL),
    ('Despia', 'Midrange / Hybrid', 'Combo'),
    ('Prank-Kids', 'Combo', NULL)
) AS v(archetype_name, primary_strategy, secondary_strategy)
CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL')) AS f(format)
ON CONFLICT (archetype_name, format) DO UPDATE
SET
  primary_strategy = EXCLUDED.primary_strategy,
  secondary_strategy = EXCLUDED.secondary_strategy;

-- Staple role weights keyed by card name → cards.id (both formats)
INSERT INTO card_strategy_weights (card_id, format, strategy, role, synergy_weight, is_boss)
SELECT c.id::text, f.format, v.strategy::yugioh_play_strategy, v.role::card_role_tag, v.weight, v.is_boss
FROM (
  VALUES
    ('Ash Blossom & Joyous Spring', 'Control', 'Hand Trap', 0.95, false),
    ('Infinite Impermanence', 'Control', 'Hand Trap', 0.95, false),
    ('Effect Veiler', 'Control', 'Hand Trap', 0.85, false),
    ('Nibiru, the Primal Being', 'Control', 'Hand Trap', 0.90, false),
    ('Maxx "C"', 'Control', 'Hand Trap', 0.95, false),
    ('Called by the Grave', 'Combo', 'Bait', 0.80, false),
    ('Forbidden Droplet', 'Aggro / Beatdown', 'Board Breaker', 0.90, false),
    ('Lightning Storm', 'Aggro / Beatdown', 'Board Breaker', 0.90, false),
    ('Dark Ruler No More', 'Aggro / Beatdown', 'Board Breaker', 0.88, false),
    ('Evenly Matched', 'Aggro / Beatdown', 'Board Breaker', 0.88, false),
    ('Pot of Prosperity', 'Combo', 'Extender', 0.75, false),
    ('Pot of Desires', 'Combo', 'Extender', 0.70, false)
) AS v(card_name, strategy, role, weight, is_boss)
JOIN cards c ON c.name = v.card_name
CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL')) AS f(format)
ON CONFLICT (card_id, format, strategy, role) DO UPDATE
SET
  synergy_weight = EXCLUDED.synergy_weight,
  is_boss = EXCLUDED.is_boss;
