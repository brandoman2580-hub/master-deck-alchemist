import { render, screen } from "@testing-library/react";
import { DeckArchiveCard } from "@/components/mda/deck-archive-card";
import { DeckDetailsModal } from "@/components/mda/archives-dialogs";
import { MdaSearchField } from "@/components/mda/search-field";
import type { DeckType } from "@/types/deck";

jest.mock("@/components/ui/card-image", () => ({
  CardImage: ({ className }: { className?: string }) => (
    <div data-testid="cover-art" className={className} />
  ),
}));

const noop = (): void => undefined;

describe("DeckArchiveCard polish", () => {
  it("does not invert the name label on hover", () => {
    render(
      <DeckArchiveCard
        name="Blue-Eyes"
        deckFormat="Master Duel"
        isPinned={false}
        mainCount={40}
        extraCount={15}
        sideCount={0}
        onOpen={noop}
        onDetails={noop}
        onCopy={noop}
        onShare={noop}
        onDelete={noop}
        onTogglePin={noop}
      />,
    );

    const name = screen.getByRole("button", { name: "Blue-Eyes" });
    expect(name.className).not.toMatch(/hover:bg-white/);
    expect(name.className).not.toMatch(/hover:text-/);
  });

  it("lifts on hover without scaling cover art", () => {
    const { container } = render(
      <DeckArchiveCard
        name="Blue-Eyes"
        deckFormat="Master Duel"
        isPinned={false}
        mainCount={40}
        extraCount={15}
        sideCount={0}
        onOpen={noop}
        onDetails={noop}
        onCopy={noop}
        onShare={noop}
        onDelete={noop}
        onTogglePin={noop}
      />,
    );

    expect(container.innerHTML).not.toMatch(/group-hover:scale/);
    expect(container.querySelector("article")?.hasAttribute("data-magnetic")).toBe(
      true,
    );
  });
});

describe("Deck List dialog magnetic targets", () => {
  const deck: DeckType = {
    id: "deck-1",
    name: "Test Deck",
    mainDeck: [],
    extraDeck: [],
    sideDeck: [],
    deckFormat: "Master Duel",
  };

  it("marks Open in Workshop, Close, and rename control as magnetic", () => {
    render(
      <DeckDetailsModal
        open
        deck={deck}
        onClose={noop}
        onOpenWorkshop={noop}
        onRename={noop}
      />,
    );

    const open = screen.getByRole("button", { name: "Open in Workshop" });
    const close = screen.getByRole("button", { name: "Close" });
    const rename = screen.getByRole("button", { name: "Rename Test Deck" });
    expect(open).toHaveAttribute("data-magnetic");
    expect(close).toHaveAttribute("data-magnetic");
    expect(rename).toHaveAttribute("data-magnetic");

    const magnetic = document.querySelectorAll("[data-magnetic]");
    expect(magnetic).toHaveLength(3);
  });
});

describe("MdaSearchField", () => {
  it("is a magnetic target", () => {
    const { container } = render(
      <MdaSearchField value="" onChange={noop} aria-label="Search decks" />,
    );
    expect(container.querySelector("[data-magnetic]")).not.toBeNull();
  });
});
