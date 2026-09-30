/**
 * Workshop card library — full filtered pool is available (no hard 120 cap)
 * and tiles share deck-builder dimensions.
 */

import { render, screen, waitFor } from "@testing-library/react";
import {
  measureColumnCount,
  WorkshopCardLibrary,
} from "@/components/mda/workshop-card-library";
import { WORKSHOP_CARD_TILE } from "@/components/mda/workshop-card-dims";
import type { Card } from "@/types/card";

jest.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => Math.max(count, 1) * 160,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        key: index,
        index,
        start: index * 160,
        size: 160,
      })),
    measure: jest.fn(),
  }),
}));

jest.mock("@/components/ui/card-image", () => ({
  CardImage: ({ card }: { card: Card }) => (
    <span data-testid={`card-art-${card.id}`}>{card.name}</span>
  ),
}));

jest.mock("@/components/mda/mda-card-preview", () => ({
  MdaCardPreview: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

function makeCard(id: number, name: string): Card {
  return {
    id,
    name,
    type: "Effect Monster",
    race: "Dragon",
    attribute: "LIGHT",
    level: 4,
    atk: 1500,
    def: 1200,
    desc: `${name} effect`,
    deckInstanceId: "",
    card_images: [],
    card_sets: [],
    card_prices: [],
    misc_info: [],
  } as Card;
}

describe("WorkshopCardLibrary", () => {
  it("renders beyond the former 120-card hard cap when the pool is large", () => {
    const cards = Array.from({ length: 150 }, (_, index) =>
      makeCard(index + 1, `Card ${String(index + 1).padStart(3, "0")}`),
    );

    render(
      <div style={{ width: 420, height: 640 }}>
        <WorkshopCardLibrary
          cards={cards}
          cardPoolSize={cards.length}
          banlist={{}}
          getRemainingCopies={() => 3}
          onAdd={jest.fn()}
          onDragStart={jest.fn()}
        />
      </div>,
    );

    expect(screen.getByText(/150 cards/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Add Card 121")).toBeInTheDocument();
    expect(screen.getByLabelText("Add Card 150")).toBeInTheDocument();
  });

  it("uses the shared deck-builder tile width classes on library cards", () => {
    render(
      <WorkshopCardLibrary
        cards={[makeCard(1, "Blue-Eyes White Dragon")]}
        cardPoolSize={1}
        banlist={{}}
        getRemainingCopies={() => 3}
        onAdd={jest.fn()}
        onDragStart={jest.fn()}
      />,
    );

    const button = screen.getByLabelText("Add Blue-Eyes White Dragon");
    expect(button.className).toContain("sm:w-[104px]");
    expect(button.className).toContain("aspect-[59/86]");
    expect(button.className).toContain("max-w-[104px]");
    expect(button.className.split(/\s+/)).not.toContain("w-full");
    for (const token of WORKSHOP_CARD_TILE.split(/\s+/)) {
      expect(button.className.split(/\s+/)).toContain(token);
    }
  });

  it("shows loading copy when the pool has not hydrated yet", () => {
    render(
      <WorkshopCardLibrary
        cards={[]}
        cardPoolSize={0}
        banlist={{}}
        getRemainingCopies={() => 0}
        onAdd={jest.fn()}
        onDragStart={jest.fn()}
      />,
    );
    expect(screen.getByText(/loading card library/i)).toBeInTheDocument();
  });

  it("measures multi-column layouts for wide containers", () => {
    expect(measureColumnCount(420, 104)).toBeGreaterThan(1);
    expect(measureColumnCount(0, 104)).toBe(1);
  });

  it("remeasures columns after the library finishes hydrating", async () => {
    const cards = Array.from({ length: 12 }, (_, index) =>
      makeCard(index + 1, `Card ${index + 1}`),
    );

    const { rerender, container } = render(
      <div style={{ width: 420, height: 640 }}>
        <WorkshopCardLibrary
          cards={[]}
          cardPoolSize={0}
          banlist={{}}
          getRemainingCopies={() => 3}
          onAdd={jest.fn()}
          onDragStart={jest.fn()}
        />
      </div>,
    );

    expect(screen.getByText(/loading card library/i)).toBeInTheDocument();

    rerender(
      <div style={{ width: 420, height: 640 }}>
        <WorkshopCardLibrary
          cards={cards}
          cardPoolSize={cards.length}
          banlist={{}}
          getRemainingCopies={() => 3}
          onAdd={jest.fn()}
          onDragStart={jest.fn()}
        />
      </div>,
    );

    const scroll = container.querySelector(".overflow-y-auto");
    expect(scroll).toBeTruthy();
    Object.defineProperty(scroll, "clientWidth", {
      configurable: true,
      value: 420,
    });
    window.dispatchEvent(new Event("resize"));

    await waitFor(() => {
      // Wide 420px container with ~104px tiles ⇒ multiple cards per row.
      // Virtualizer mock emits one virtual item per row; with 12 cards and
      // ≥3 columns we should see fewer than 12 row wrappers.
      const rows = container.querySelectorAll("[data-index]");
      expect(rows.length).toBeLessThan(12);
      expect(rows.length).toBeGreaterThan(0);
    });
  });
});
