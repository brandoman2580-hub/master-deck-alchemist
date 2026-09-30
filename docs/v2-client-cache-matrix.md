# V2 client cache matrix (Phase 1b)

## Architecture

Query owns **fetch + invalidation + in-memory freshness**. IndexedDB is the **disk** adapter for the card catalog only. Live workshop decks use Zustand + optional `sessionStorage` refresh restore.

| Data | Persist? | Cache owner | Invalidate when |
|------|----------|-------------|-----------------|
| Card library (~13k) | IndexedDB 7d TTL + schema `CARD_LIBRARY_CACHE_SCHEMA` | TanStack Query `card-library` via [`lib/query/card-library.ts`](../lib/query/card-library.ts); mirrors into `useCardStore` until post-QA retirement | Schema bump / TTL miss / `invalidateQueries(cardLibraryQueryKey())` |
| User deck list (Archives) | Query memory only (auth-scoped; no IDB) | [`hooks/useUserDecks.ts`](../hooks/useUserDecks.ts) (`staleTime: Infinity`) | Save / rename / delete / pin / copy mutations |
| Live workshop deck | Zustand + `sessionStorage` refresh restore (skip empty `"New Deck"`) | [`store/liveDeckStore.ts`](../store/liveDeckStore.ts) + [`lib/deck/live-deck-session.ts`](../lib/deck/live-deck-session.ts); Context shim | Cleared on `clearDeck` / empty draft |
| Facts envelope (Matchups + Combos + Grade) | Engine disk cache + TanStack Query keyed by `deckHash` + `deckFormat` + banlist epoch | [`hooks/useWorkshopFacts.ts`](../hooks/useWorkshopFacts.ts) | Live deck hash changes; banlist reload |
| Strategist thread | Existing client persistence | Unchanged in 1b | — |
| Banlist tables | Load on `deckFormat` change | Live deck store slice | Format change |

## Rules

1. **Matchups and Combos share one Facts Query** — do not each call `getFacts` independently.
2. **Do not dual-write** live deck arrays in Context and Zustand.
3. **Deck caps:** soft 60 / hard 75 account total ([`lib/deck/deck-caps.ts`](../lib/deck/deck-caps.ts)); server trigger on `INSERT`.
4. **Format SSoT:** `currentDeck.deckFormat` (DB column remains `mode`).
