-- Facts Brain Phase 0: strategy weights, combo templates, analysis cache
-- Formats: TCG + MASTER_DUEL from day one.
-- Safe to re-run: uses IF NOT EXISTS / exception guards for enums.

DO $$
BEGIN
  CREATE TYPE yugioh_play_strategy AS ENUM (
    'Combo',
    'Control',
    'Aggro / Beatdown',
    'OTK / FTK',
    'Stun / Floodgate',
    'Burn',
    'Swarm',
    'Midrange / Hybrid'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE card_role_tag AS ENUM (
    'Starter',
    'Extender',
    'Chokepoint',
    'Bait',
    'Lock',
    'Endboard',
    'Board Breaker',
    'Hand Trap'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS archetype_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('TCG', 'MASTER_DUEL')),
  primary_strategy yugioh_play_strategy NOT NULL,
  secondary_strategy yugioh_play_strategy,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (archetype_name, format)
);

CREATE TABLE IF NOT EXISTS card_strategy_weights (
  card_id TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('TCG', 'MASTER_DUEL')),
  strategy yugioh_play_strategy NOT NULL,
  role card_role_tag NOT NULL,
  synergy_weight NUMERIC(3, 2) NOT NULL CHECK (synergy_weight BETWEEN 0.00 AND 1.00),
  is_boss BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (card_id, format, strategy, role)
);

CREATE TABLE IF NOT EXISTS combo_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('TCG', 'MASTER_DUEL')),
  name TEXT NOT NULL,
  bosses TEXT[] NOT NULL DEFAULT '{}',
  graph JSONB NOT NULL,
  killers TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS combo_templates_archetype_format_idx
  ON combo_templates (archetype_name, format);

CREATE TABLE IF NOT EXISTS deck_analysis_cache (
  deck_id UUID PRIMARY KEY,
  deck_hash TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('TCG', 'MASTER_DUEL')),
  facts JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deck_analysis_cache_hash_format_idx
  ON deck_analysis_cache (deck_hash, format);

COMMENT ON TABLE archetype_strategies IS 'Curated play-strategy profiles per archetype and format (TCG / MASTER_DUEL).';
COMMENT ON TABLE card_strategy_weights IS 'Curated card role/strategy weights; refreshed with card/meta pipelines.';
COMMENT ON TABLE combo_templates IS 'Seeded/curated combo graphs consumed by the combo compiler edge function.';
COMMENT ON TABLE deck_analysis_cache IS 'Cached FactsEnvelope payloads keyed by deck_id + content hash.';
