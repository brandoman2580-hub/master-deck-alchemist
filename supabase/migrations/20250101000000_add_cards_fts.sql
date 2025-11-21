-- Enable pg_trgm extension for trigram similarity (optional, but useful for fuzzy matching)
create extension if not exists pg_trgm;

-- Add generated tsvector column for full-text search
alter table public.cards
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' ||
      coalesce(type, '') || ' ' ||
      coalesce("desc", '') || ' ' ||
      coalesce(archetype, '') || ' ' ||
      coalesce(race, '') || ' ' ||
      coalesce(attribute, '')
    )
  ) stored;

-- Create GIN index on search_vector for fast full-text search
create index if not exists cards_search_vector_idx
  on public.cards
  using gin (search_vector);

-- Create RPC function for ranked full-text search with banlist awareness
create or replace function public.match_cards_by_text (
  query text,
  match_count int,
  excluded_ids integer[] default '{}',
  banlist_format text default 'TCG'
)
returns table (
  card_id integer,
  name text,
  type text,
  "desc" text,
  archetype text,
  attribute text,
  race text,
  rank real
)
language sql
as $$
  select
    c.id as card_id,
    c.name,
    c.type,
    c."desc",
    c.archetype,
    c.attribute,
    c.race,
    ts_rank_cd(
      c.search_vector,
      plainto_tsquery('english', query)
    ) as rank
  from cards c
  where
    not (c.id = any (excluded_ids))
    and (
      -- TCG: filter using cards.ban_tcg (treat 'Banned' as Forbidden)
      (banlist_format = 'TCG' and coalesce(c.ban_tcg, '') <> 'Banned')
      -- MASTER_DUEL and others: let the edge function apply its own banlist map
      or (banlist_format <> 'TCG')
    )
    and c.search_vector @@ plainto_tsquery('english', query)
  order by rank desc
  limit match_count;
$$;

