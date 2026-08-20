import { render, screen } from "@testing-library/react";
import { DeckArchiveCard } from "@/components/mda/deck-archive-card";
import { DeckDetailsModal } from "@/components/mda/archives-dialogs";
import { MdaSearchField } from "@/components/mda/search-field";
import type { DeckType } from "@/types/types";

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
        mode="Master Duel"
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
        mode="Master Duel"
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
    mode: "Master Duel",
  };

  it("marks only Open in Workshop and Close as magnetic", () => {
    render(
      <DeckDetailsModal open deck={deck} onClose={noop} onOpenWorkshop={noop} />,
    );

    const open = screen.getByRole("button", { name: "Open in Workshop" });
    const close = screen.getByRole("button", { name: "Close" });
    expect(open).toHaveAttribute("data-magnetic");
    expect(close).toHaveAttribute("data-magnetic");

    const magnetic = document.querySelectorAll("[data-magnetic]");
    expect(magnetic).toHaveLength(2);
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
