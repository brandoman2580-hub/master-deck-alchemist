import { readFileSync } from "fs";
import { join } from "path";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import {
  WorkshopCombosPane,
  type WorkshopComboLineView,
} from "@/components/mda/workshop-combos-pane";
import { blankDeckComboGraph } from "@/lib/combos/deck-combo-graph";
import type { DeckCard } from "@/types/deck";

expect.extend(toHaveNoViolations);

function card(id: number, name: string, desc: string): DeckCard {
  return {
    id,
    name,
    type: "Effect Monster",
    desc,
    deckInstanceId: `inst-${id}`,
  } as DeckCard;
}

const searcher = card(10, "Snake-Eye Ash", 'Add 1 "Snake-Eye" monster from your Deck to your hand.');
const beater = card(11, "Alexandrite Dragon", "A dragon of light that attacks with a shining body.");

function savedLine(): WorkshopComboLineView {
  return {
    id: "line-1",
    name: "Poplar Line",
    graph: {
      playRows: [{ id: "row-1" }],
      nodes: [
        {
          id: "step-1",
          label: "Snake-Eye Ash",
          cardName: "Snake-Eye Ash",
          cardIds: [10],
          kind: "step",
          lane: "play",
          rowId: "row-1",
          order: 0,
        },
      ],
      edges: [],
      endboardSummary: "Diabellstar end",
    },
  };
}

function Harness({
  initial = [savedLine()],
  cards = [searcher, beater],
  onDelete,
}: {
  initial?: WorkshopComboLineView[];
  cards?: DeckCard[];
  onDelete?: (id: string) => void;
}) {
  const [lines, setLines] = useState(initial);
  return (
    <WorkshopCombosPane
      canSave
      cards={cards}
      lines={lines}
      onCreate={(name, graph) =>
        setLines((current) => [
          ...current,
          {
            id: `line-${current.length + 1}`,
            name,
            graph: graph.playRows.length > 0 ? graph : blankDeckComboGraph("row-created"),
          },
        ])
      }
      onRename={(id, name) =>
        setLines((current) => current.map((line) => (line.id === id ? { ...line, name } : line)))
      }
      onDelete={(id) => {
        onDelete?.(id);
        setLines((current) => current.filter((line) => line.id !== id));
      }}
      onChangeGraph={(id, graph) =>
        setLines((current) => current.map((line) => (line.id === id ? { ...line, graph } : line)))
      }
    />
  );
}

describe("facts_brain_phase3 combo seed migration", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260908020000_facts_brain_phase3_combo_templates.sql"),
    "utf8",
  );

  it("seeds combo_templates for both formats", () => {
    expect(sql).toContain("INSERT INTO combo_templates");
    expect(sql).toContain("Snake-Eye");
    expect(sql).toContain("CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL'))");
  });
});

describe("WorkshopCombosPane", () => {
  it("shows the side deck only for a TCG list", () => {
    const sections = [
      { title: "Main Deck", cards: [searcher] },
      { title: "Extra Deck", cards: [beater] },
      { title: "Side Deck", cards: [] },
    ];
    const handlers = {
      onCreate: () => undefined,
      onRename: () => undefined,
      onDelete: () => undefined,
      onChangeGraph: () => undefined,
    };
    const { rerender } = render(
      <WorkshopCombosPane
        canSave
        lines={[savedLine()]}
        cards={[searcher, beater]}
        sections={sections}
        deckFormat="Master Duel"
        {...handlers}
      />,
    );
    expect(screen.getByRole("heading", { name: "Main Deck" })).toBeInTheDocument();
    expect(screen.queryByText(/release to return this card/i)).not.toBeInTheDocument();
    const pool = document.querySelector("[data-combo-pool]");
    const overlay = document.querySelector("[data-combo-drop-plus]");
    expect(overlay).toHaveClass("hidden", "z-20");
    expect(pool?.firstElementChild).toHaveClass("z-0");
    for (const count of screen.getAllByText(/\d+ remaining/)) {
      expect(count).toHaveClass("z-10");
      expect(count).not.toHaveClass("z-30");
    }
    expect(screen.getByRole("heading", { name: "Extra Deck" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Side Deck" })).not.toBeInTheDocument();
    rerender(
      <WorkshopCombosPane
        canSave
        lines={[savedLine()]}
        cards={[searcher, beater]}
        sections={sections}
        deckFormat="TCG"
        {...handlers}
      />,
    );
    expect(screen.getByRole("heading", { name: "Side Deck" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Side Deck" })).toHaveTextContent("No cards in this deck");
  });

  it("asks for a deck save before storing lines", () => {
    render(
      <WorkshopCombosPane
        canSave={false}
        lines={[]}
        onCreate={() => undefined}
        onRename={() => undefined}
        onDelete={() => undefined}
        onChangeGraph={() => undefined}
      />,
    );
    expect(screen.getByText(/Save this deck to store combo boards/i)).toBeInTheDocument();
  });

  it("starts from a blank board and explains that in a dialog", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);
    const dialog = screen.getByRole("dialog", { name: /No saved combo boards/i });
    expect(dialog).toHaveTextContent(/There are no saved combo boards yet/i);
    expect(dialog).toHaveTextContent(/lightbulb/i);
    expect(within(dialog).getByRole("button", { name: "Save board" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Open Opening board" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Close boards" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Start from a template" })).not.toBeInTheDocument();
    expect(screen.queryByRole("banner", { name: "Combo lines" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Combo progression/i, { hidden: true })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^Close$/ }));
    expect(screen.getByRole("heading", { name: "Combos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a row below play 1" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "How to build your combo board" }));
    expect(screen.getByRole("dialog", { name: /How to build your combo board/i })).toHaveTextContent(
      /Click the board name in the upper right/i,
    );
    await user.click(screen.getByRole("button", { name: /^Close$/ }));
    await user.click(screen.getByRole("button", { name: "Name this board" }));
    await user.type(screen.getByRole("textbox", { name: "Combo board name" }), "Night board");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /Combo board name, Night board/i })).toBeInTheDocument();
  });

  it("keeps the load error in the boards dialog and still shows the board", () => {
    render(
      <WorkshopCombosPane
        canSave
        lines={[]}
        error="Combo boards could not be loaded."
        onCreate={() => undefined}
        onRename={() => undefined}
        onDelete={() => undefined}
        onChangeGraph={() => undefined}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: /No saved combo boards/i });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/could not be loaded/i);
    expect(screen.getByLabelText(/Combo progression/i, { hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole("banner", { name: "Combo lines" })).not.toBeInTheDocument();
  });

  it("keeps the end board last when a play row is added and warns on a search step", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    expect(screen.getByRole("button", { name: /Combo board name, Poplar Line/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("banner", { name: "Combo lines" })).not.toBeInTheDocument();
    expect(screen.queryByText(/can stop Snake-Eye Ash/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Snake-Eye Ash, Play" })).toHaveAttribute("data-ash-warning", "true");
    const warning = screen.getByRole("button", {
      name: /If the opponent uses Ash Blossom here, this effect is negated because it adds a card from the Deck to the hand/i,
    });
    expect(warning).toBeInTheDocument();
    expect(screen.queryByText("Ash")).not.toBeInTheDocument();
    await user.hover(warning);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/this effect is negated because it adds a card from the Deck to the hand/i);
    expect(
      await screen.findByText(/this effect is negated because it adds a card from the Deck to the hand/i, {
        selector: ".font-spaceGrotesk",
      }),
    ).toBeInTheDocument();
    const board = within(screen.getByLabelText(/Combo progression/i));
    expect(board.getByText("XYZ material")).toBeInTheDocument();
    expect(board.getByText("Spells")).toBeInTheDocument();
    expect(board.getByText("Traps")).toBeInTheDocument();
    expect(board.getByText("Graveyard")).toBeInTheDocument();
    expect(board.getByText("Banish")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a row below play 1" }));
    const play2 = board.getByText("Play 2");
    const end = board.getByText("End board");
    expect(play2.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove play 2" }));
    expect(board.queryByText("Play 2")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Against these decks" })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("deletes the open line", async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    render(<Harness onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: "Boards" }));
    await user.click(screen.getByRole("button", { name: "Rename Poplar Line" }));
    const rename = screen.getByRole("textbox", { name: "Rename Poplar Line" });
    expect(rename).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Rename Poplar Line" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Combo boards/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rename Poplar Line" }));
    const nextName = screen.getByRole("textbox", { name: "Rename Poplar Line" });
    await user.clear(nextName);
    await user.type(nextName, "Night board");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(screen.getByRole("button", { name: "Rename Night board" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Delete Night board" }));
    expect(onDelete).toHaveBeenCalledWith("line-1");
    expect(screen.getByRole("dialog", { name: /No saved combo boards/i })).toHaveTextContent(/There are no saved combo boards yet/i);
  });

  it("places a deck card from the keyboard and draws a link from a card edge", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const poolCard = screen.getByRole("button", { name: /Drag Alexandrite Dragon/i });
    poolCard.focus();
    await user.keyboard("{Enter}");
    const handle = screen.getByRole("button", { name: "Link from the bottom of Snake-Eye Ash" });
    const target = screen.getByRole("button", { name: "Link from the top of Alexandrite Dragon" });
    const topAnchor = target.parentElement?.querySelector(".react-flow__handle.target[data-handleid='top']") ?? target;
    const root = HTMLElement.prototype.getRootNode;
    const clone = globalThis.structuredClone;
    HTMLElement.prototype.getRootNode = function getRootNode() {
      return document;
    };
    globalThis.structuredClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
    let hovered: Element | null = handle;
    document.elementFromPoint = () => hovered;
    try {
      await user.click(handle);
      expect(handle).toHaveAttribute("aria-pressed", "true");
      hovered = topAnchor;
      await user.click(target);
    } finally {
      HTMLElement.prototype.getRootNode = root;
      globalThis.structuredClone = clone;
    }
    expect(screen.getByText(/Snake-Eye Ash plays to Alexandrite Dragon, from the bottom to the top/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark disruption" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Snake-Eye Ash, Play/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alexandrite Dragon, Play/i })).toBeInTheDocument();
  });

  it("fades a card once every deck copy is on the board", async () => {
    const user = userEvent.setup();
    const twin = card(11, "Alexandrite Dragon", "A dragon of light that attacks with a shining body.");
    twin.deckInstanceId = "inst-11b";
    render(<Harness cards={[searcher, beater, twin]} />);
    expect(screen.getByRole("button", { name: /Snake-Eye Ash, no copies left in this deck/i })).toBeDisabled();
    const first = screen.getByRole("button", { name: /Drag Alexandrite Dragon onto the board, 2 remaining/i });
    first.focus();
    await user.keyboard("{Enter}");
    const second = screen.getByRole("button", { name: /Drag Alexandrite Dragon onto the board, 1 remaining/i });
    second.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /Alexandrite Dragon, no copies left in this deck/i })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /Alexandrite Dragon, Play/i })).toHaveLength(2);
  });

  it("returns a placed copy to the deck stack", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(
      screen.getByRole("complementary", { name: /Drop a board card here to return that copy/i }),
    ).toBeInTheDocument();
    const poolCard = screen.getByRole("button", { name: /Drag Alexandrite Dragon onto the board, 1 remaining/i });
    poolCard.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /Alexandrite Dragon, no copies left in this deck/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Alexandrite Dragon, Play/i }));
    await user.click(screen.getByRole("button", { name: "Remove Alexandrite Dragon" }));
    expect(screen.getByRole("button", { name: /Drag Alexandrite Dragon onto the board, 1 remaining/i })).toBeEnabled();
  });

  it("marks a card that left the deck", () => {
    render(<Harness cards={[beater]} />);
    expect(screen.getByRole("button", { name: /Snake-Eye Ash, Play, missing from this deck/i })).toBeInTheDocument();
    expect(screen.getByText(/A card left this deck/i)).toBeInTheDocument();
  });
});
