-- Player-authored combo lines, one JSON graph per line, owned by a deck.

create table public.deck_combo_lines (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  graph jsonb not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deck_combo_lines_name_not_blank check (char_length(btrim(name)) > 0)
);

create index deck_combo_lines_deck_position_idx
  on public.deck_combo_lines (deck_id, position);

alter table public.deck_combo_lines enable row level security;

create policy deck_combo_lines_select
  on public.deck_combo_lines
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.decks as decks
      where decks.id = deck_combo_lines.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy deck_combo_lines_insert
  on public.deck_combo_lines
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.decks as decks
      where decks.id = deck_combo_lines.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy deck_combo_lines_update
  on public.deck_combo_lines
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.decks as decks
      where decks.id = deck_combo_lines.deck_id
        and decks.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.decks as decks
      where decks.id = deck_combo_lines.deck_id
        and decks.user_id = auth.uid()
    )
  );

create policy deck_combo_lines_delete
  on public.deck_combo_lines
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.decks as decks
      where decks.id = deck_combo_lines.deck_id
        and decks.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.deck_combo_lines to authenticated;
