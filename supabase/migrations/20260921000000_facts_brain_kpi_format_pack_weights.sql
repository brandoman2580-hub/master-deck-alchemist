-- Facts Brain: reinforce Maxx-out + TCG interaction staple weights for KPI format packs.
-- Safe re-run via ON CONFLICT. Unknown card names are skipped by JOIN.

INSERT INTO card_strategy_weights (card_id, format, strategy, role, synergy_weight, is_boss)
SELECT c.id::text, f.format, v.strategy::yugioh_play_strategy, v.role::card_role_tag, v.weight, v.is_boss
FROM (
  VALUES
    -- Hard Maxx "C" outs (MD resiliency pack counts these by name)
    ('Ash Blossom & Joyous Spring', 'Control', 'Hand Trap', 0.97, false),
    ('Called by the Grave', 'Combo', 'Bait', 0.90, false),
    ('Crossout Designator', 'Combo', 'Bait', 0.88, false),

    -- TCG / general interaction suite (density feeds tcgTournament pack)
    ('Infinite Impermanence', 'Control', 'Hand Trap', 0.96, false),
    ('Effect Veiler', 'Control', 'Hand Trap', 0.86, false),
    ('Nibiru, the Primal Being', 'Control', 'Hand Trap', 0.91, false),
    ('Droll & Lock Bird', 'Control', 'Hand Trap', 0.93, false),
    ('Forbidden Droplet', 'Aggro / Beatdown', 'Board Breaker', 0.91, false),
    ('Lightning Storm', 'Aggro / Beatdown', 'Board Breaker', 0.91, false),
    ('Dark Ruler No More', 'Aggro / Beatdown', 'Board Breaker', 0.89, false),
    ('Evenly Matched', 'Aggro / Beatdown', 'Board Breaker', 0.89, false),
    ('Maxx "C"', 'Control', 'Hand Trap', 0.96, false)
) AS v(card_name, strategy, role, weight, is_boss)
JOIN cards c ON c.name = v.card_name
CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL')) AS f(format)
ON CONFLICT (card_id, format, strategy, role) DO UPDATE
SET
  synergy_weight = EXCLUDED.synergy_weight,
  is_boss = EXCLUDED.is_boss;
