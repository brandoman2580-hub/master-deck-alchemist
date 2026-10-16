import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeckArchiveCard } from "@/components/mda/deck-archive-card";
import { DeckDetailsModal } from "@/components/mda/archives-dialogs";
import { MdaSearchField } from "@/components/mda/search-field";
import { SectionCollapse } from "@/components/mda/section-collapse";
import type { DeckType } from "@/types/deck";

jest.mock("@/components/ui/card-image", () => ({
  CardImage: ({ className }: { className?: string }) => (
    <div data-testid="cover-art" className={className} />
  ),
}));

const noop = (): void => undefined;

describe("DeckArchiveCard polish", () => {
  it("uses a light shell with cover art as the inverse island", () => {
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

    const article = container.querySelector("article");
    expect(article?.className).toMatch(/bg-mda-surface-raised/);
    expect(article?.className).not.toMatch(/bg-mda-inverse(?:\s|$)/);
    expect(container.querySelector("[data-mda-c-brackets]")).toBeNull();

    const name = screen.getByRole("button", { name: "Blue-Eyes" });
    expect(name.className).toMatch(/text-mda-ink-strong/);
    expect(name.className).not.toMatch(/bg-mda-panel/);
    expect(name.className).not.toMatch(/hover:bg-white/);

    const details = screen.getByRole("button", { name: "Details" });
    expect(details.className).toMatch(/border-mda-bezel/);
    expect(details.className).toMatch(/min-h-11/);
    expect(details.className).not.toMatch(/bg-mda-sky/);
    expect(details.className).toMatch(/w-full/);
  });

  it("stacks each deck count above its spelled-out section name", () => {
    const { container } = render(
      <DeckArchiveCard
        name="Blue-Eyes"
        deckFormat="TCG"
        isPinned={false}
        mainCount={54}
        extraCount={12}
        sideCount={8}
        onOpen={noop}
        onDetails={noop}
        onCopy={noop}
        onShare={noop}
        onDelete={noop}
        onTogglePin={noop}
      />,
    );

    const row = container.querySelector(".flex-row.flex-wrap");
    expect(row).not.toBeNull();
    expect(row?.className).toMatch(/justify-start/);

    const main = screen.getByLabelText("Main Deck, 54");
    const extra = screen.getByLabelText("Extra Deck, 12");
    const side = screen.getByLabelText("Side Deck, 8");

    expect(main.className).toMatch(/flex-col/);
    expect(extra.className).toMatch(/flex-col/);
    expect(side.className).toMatch(/flex-col/);
    expect(main.querySelector(".text-base")).not.toBeNull();
    expect(main.querySelector(".text-xs")?.textContent).toBe("Main Deck");
    expect(row?.contains(main)).toBe(true);
    expect(row?.contains(extra)).toBe(true);
    expect(row?.contains(side)).toBe(true);
  });

  it("omits the side deck stat on Master Duel cards", () => {
    render(
      <DeckArchiveCard
        name="Pure Darkness"
        deckFormat="Master Duel"
        isPinned={false}
        mainCount={54}
        extraCount={12}
        sideCount={0}
        onOpen={noop}
        onDetails={noop}
        onCopy={noop}
        onShare={noop}
        onDelete={noop}
        onTogglePin={noop}
      />,
    );

    expect(screen.getByLabelText("Main Deck, 54")).toBeInTheDocument();
    expect(screen.getByLabelText("Extra Deck, 12")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Side Deck/)).toBeNull();
  });

  it("uses a golden-ratio shell with format under the art and actions in the ellipsis menu", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DeckArchiveCard
        name="Pure Darkness"
        deckFormat="Master Duel"
        isPinned={false}
        mainCount={54}
        extraCount={12}
        sideCount={0}
        onOpen={noop}
        onDetails={noop}
        onCopy={noop}
        onShare={noop}
        onDelete={noop}
        onTogglePin={noop}
      />,
    );

    const article = container.querySelector("article");
    expect(article?.className).toMatch(/aspect-\[1\/1\.618\]/);
    expect(article?.className).toMatch(/w-4\/5/);

    const thumbnail = article?.children[0];
    const footer = article?.children[1];
    expect(thumbnail?.textContent).not.toMatch(/Master Duel/);
    expect(footer?.textContent?.indexOf("Master Duel")).toBeGreaterThanOrEqual(0);
    expect(footer?.textContent?.indexOf("Master Duel") ?? -1).toBeLessThan(
      footer?.textContent?.indexOf("Pure Darkness") ?? 0,
    );

    const pin = screen.getByRole("button", { name: "Pin deck" });
    const more = screen.getByRole("button", { name: "More actions for Pure Darkness" });
    expect(thumbnail?.contains(pin)).toBe(true);
    expect(thumbnail?.contains(more)).toBe(true);
    expect(more.className).toMatch(/backdrop-blur-\[12px\]/);
    expect(more.className).toMatch(/bg-\[rgba\(247,251,253,0\.3\)\]/);

    expect(screen.queryByRole("button", { name: "Copy Pure Darkness" })).toBeNull();
    await user.click(more);

    const menu = screen.getByRole("group", { name: "Pure Darkness actions" });
    expect(menu.className).toMatch(/flex-col/);
    expect(thumbnail?.contains(menu)).toBe(true);
    expect(screen.getByRole("button", { name: "Copy Pure Darkness" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share Pure Darkness" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Pure Darkness" })).toBeInTheDocument();
    const details = screen.getByRole("button", { name: "Details" });
    expect(details.className).toMatch(/w-full/);
    expect(details.parentElement?.className).toMatch(/p-1/);
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

describe("SectionCollapse chrome", () => {
  it("uses quiet ink border instead of heavy chrome box", () => {
    const { container } = render(
      <SectionCollapse title="Pinned" open onToggle={noop}>
        <p>Body</p>
      </SectionCollapse>,
    );

    const section = container.querySelector("section");
    expect(section?.className).toMatch(/border-mda-ink\/15/);
    expect(section?.className).not.toMatch(/border-mda-chrome/);
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
