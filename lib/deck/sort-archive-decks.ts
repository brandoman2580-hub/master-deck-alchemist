import type { ClientDeck } from "@/types/deck";

/** Archive list sorts. `newest` matches the database `updated_at` descending order. */
export type ArchiveDeckSort = "newest" | "oldest" | "az" | "za" | "format";

export const ARCHIVE_DECK_SORTS: readonly {
  value: ArchiveDeckSort;
  label: string;
}[] = [
  { value: "newest", label: "newest-oldest" },
  { value: "oldest", label: "oldest-newest" },
  { value: "az", label: "a-z" },
  { value: "za", label: "z-a" },
  { value: "format", label: "format" },
];

function updatedAtMs(deck: ClientDeck): number {
  const parsed = Date.parse(deck.updated_at ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareName(a: ClientDeck, b: ClientDeck): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

function compareWithinSort(sort: ArchiveDeckSort, a: ClientDeck, b: ClientDeck): number {
  switch (sort) {
    case "oldest":
      return updatedAtMs(a) - updatedAtMs(b) || compareName(a, b);
    case "az":
      return compareName(a, b);
    case "za":
      return compareName(b, a);
    case "format":
      return (
        a.deckFormat.localeCompare(b.deckFormat, undefined, {
          sensitivity: "base",
        }) ||
        updatedAtMs(b) - updatedAtMs(a) ||
        compareName(a, b)
      );
    case "newest":
    default:
      return updatedAtMs(b) - updatedAtMs(a) || compareName(a, b);
  }
}

/**
 * Pinned decks stay at the top. Each group is ordered by `sort`.
 * `newest` is the default and matches `getUserDecks` (`updated_at` descending).
 * Does not mutate `decks`.
 */
export function sortArchiveDecks(
  decks: readonly ClientDeck[],
  sort: ArchiveDeckSort = "newest",
): ClientDeck[] {
  const pinned: ClientDeck[] = [];
  const rest: ClientDeck[] = [];
  for (const deck of decks) {
    if (deck.isPinned) pinned.push(deck);
    else rest.push(deck);
  }
  pinned.sort((a, b) => compareWithinSort(sort, a, b));
  rest.sort((a, b) => compareWithinSort(sort, a, b));
  return pinned.concat(rest);
}
