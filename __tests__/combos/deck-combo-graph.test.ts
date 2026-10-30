import { readFileSync } from "fs";
import { join } from "path";
import {
  addCardToGraph,
  addComboLink,
  removeComboLink,
  addPlayRowBelow,
  blankDeckComboGraph,
  COMBO_FLOW_COL,
  FLOW_ORIGIN_X,
  cardDropScreenPoint,
  endZoneFrames,
  reflowBoardColumns,
  insertPlayRowAt,
  moveNodeInGraph,
  comboFlowPayload,
  fizzledNodeIds,
  parseDeckComboGraph,
  storedBoardGraph,
  placeCardAt,
  toggleNodeDisruption,
  graphFromTemplate,
  graphSaveError,
  missingCardNodeIds,
  removeEmptyPlayRow,
} from "@/lib/combos/deck-combo-graph";
import type { ComboTemplateRow } from "@/lib/engine/combos";
import { ashClauseForText, ashWarningsForSteps } from "@/lib/combos/ash-warnings";

const snakeTemplate: ComboTemplateRow = {
  id: "tmpl-snake",
  archetypeName: "Snake-Eye",
  format: "MASTER_DUEL",
  name: "Poplar Line",
  bosses: ["Diabellstar the Black Witch"],
  killers: ["Ash Blossom & Joyous Spring"],
  graph: {
    endboardSummary: "Diabellstar end",
    nodes: [
      { id: "h1", label: "Ash", cardNames: ["Snake-Eye Ash"], kind: "hand", required: true },
      { id: "s1", label: "Search", cardNames: ["Snake-Eye Ash"], kind: "step", required: true },
      { id: "e1", label: "Close", cardNames: ["Diabellstar the Black Witch"], kind: "endboard", required: true },
    ],
    edges: [
      { from: "h1", to: "s1" },
      { from: "s1", to: "e1" },
    ],
  },
};

describe("deck combo graph", () => {
  it("rejects a card that is not in the deck and reloads a cut card as missing", () => {
    const deckIds = new Set([10]);
    let graph = blankDeckComboGraph("row-1");
    graph = addCardToGraph(graph, { kind: "play", rowId: "row-1" }, { id: 99, name: "Outside" }, "n-out");
    expect(graphSaveError(graph, deckIds)).toBe("A saved board can only contain cards from this deck.");
    expect(missingCardNodeIds(graph, deckIds)).toEqual(["n-out"]);

    graph = addCardToGraph(
      blankDeckComboGraph("row-1"),
      { kind: "play", rowId: "row-1" },
      { id: 10, name: "In deck" },
      "n-in",
    );
    expect(graphSaveError(graph, deckIds)).toBeNull();
    expect(missingCardNodeIds(graph, new Set<number>())).toEqual(["n-in"]);
  });

  it("copies a template without opponent interruptions", () => {
    const copied = graphFromTemplate(snakeTemplate, [
      { id: 10, name: "Snake-Eye Ash", zone: "main" },
      { id: 11, name: "Diabellstar the Black Witch", zone: "extra" },
    ], "row-copy");
    expect(copied).not.toBeNull();
    expect(copied!.playRows).toEqual([{ id: "row-copy" }]);
    expect(copied!.nodes.some((node) => node.cardName === "Ash Blossom & Joyous Spring")).toBe(false);
    expect(copied!.nodes.filter((node) => node.lane === "play").every((node) => node.rowId === "row-copy")).toBe(true);
    expect(copied!.edges.every((edge) => edge.relation !== "interrupts")).toBe(true);
  });

  it("returns null when a required template card is missing", () => {
    expect(
      graphFromTemplate(snakeTemplate, [{ id: 10, name: "Snake-Eye Ash", zone: "main" }]),
    ).toBeNull();
  });

  it("removes a play row only when that row is empty", () => {
    const graph = addCardToGraph(
      addPlayRowBelow(blankDeckComboGraph("row-1"), "row-1", "row-2"),
      { kind: "play", rowId: "row-1" },
      { id: 10, name: "Starter" },
      "n1",
    );
    expect(removeEmptyPlayRow(graph, "row-1").playRows.map((row) => row.id)).toEqual(["row-1", "row-2"]);
    expect(removeEmptyPlayRow(graph, "row-2").playRows.map((row) => row.id)).toEqual(["row-1"]);
  });

  it("inserts a play row under the opening hand and moves a card onto it", () => {
    let graph = insertPlayRowAt(blankDeckComboGraph("row-1"), null, "row-0");
    expect(graph.playRows.map((row) => row.id)).toEqual(["row-0", "row-1"]);
    graph = addCardToGraph(graph, { kind: "play", rowId: "row-1" }, { id: 10, name: "Starter" }, "n1");
    graph = moveNodeInGraph(graph, "n1", { kind: "play", rowId: "row-0" });
    expect(graph.nodes.find((node) => node.id === "n1")).toMatchObject({
      lane: "play",
      kind: "step",
      rowId: "row-0",
    });
  });

  it("stores the card edge a play link was drawn from", () => {
    let graph = addCardToGraph(blankDeckComboGraph("row-1"), { kind: "hand" }, { id: 1, name: "A" }, "a");
    graph = addCardToGraph(graph, { kind: "play", rowId: "row-1" }, { id: 2, name: "B" }, "b");
    const linked = addComboLink(graph, "a", "b", "play", { fromSide: "bottom", toSide: "top" });
    expect(linked.error).toBeNull();
    expect(linked.graph.edges[0]).toMatchObject({ fromSide: "bottom", toSide: "top", relation: "play" });
    expect(parseDeckComboGraph(linked.graph).edges[0]).toMatchObject({ fromSide: "bottom", toSide: "top" });
  });

  it("keeps the opening hand to 6 cards", () => {
    let graph = blankDeckComboGraph("row-1");
    for (let index = 0; index < 6; index += 1) {
      graph = addCardToGraph(graph, { kind: "hand" }, { id: index + 1, name: `Hand ${index + 1}` }, `hand-${index}`);
    }
    expect(graph.nodes.filter((node) => node.lane === "hand")).toHaveLength(6);
    expect(addCardToGraph(graph, { kind: "hand" }, { id: 7, name: "Seventh" }, "hand-6")).toBe(graph);
    expect(placeCardAt(graph, { id: 7, name: "Seventh" }, { x: 80, y: 40 }, "hand-drop")).toBe(graph);
    const play = addCardToGraph(graph, { kind: "play", rowId: "row-1" }, { id: 8, name: "Extender" }, "play-1");
    expect(moveNodeInGraph(play, "play-1", { kind: "hand" }).nodes.find((node) => node.id === "play-1")?.lane).toBe("play");
    const reordered = moveNodeInGraph(graph, "hand-0", { kind: "hand" }, "hand-3");
    expect(
      reordered.nodes
        .filter((node) => node.lane === "hand")
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((node) => node.id),
    ).toEqual(["hand-1", "hand-2", "hand-0", "hand-3", "hand-4", "hand-5"]);
  });

  it("snaps a dropped card onto a row and fizzles everything after a disruption", () => {
    let graph = placeCardAt(blankDeckComboGraph("row-1"), { id: 1, name: "Starter" }, { x: 24, y: 40 }, "hand-1");
    graph = placeCardAt(graph, { id: 2, name: "Extender" }, { x: 24, y: 280 }, "step-1");
    graph = addComboLink(graph, "hand-1", "step-1", "play").graph;
    graph = toggleNodeDisruption(graph, "hand-1");
    expect(graph.nodes.find((node) => node.id === "hand-1")?.lane).toBe("hand");
    expect(graph.nodes.find((node) => node.id === "step-1")?.lane).toBe("play");
    expect(fizzledNodeIds(graph).has("step-1")).toBe(true);
    const payload = comboFlowPayload(graph, new Map(), () => 2);
    expect(payload.nodes.map((node) => node.type)).toEqual(["cardNode", "cardNode"]);
    expect(payload.nodes[0]?.data).toMatchObject({ cardId: 1, name: "Starter", currentQuantity: 2 });
    expect(payload.edges[0]?.data.isDisruption).toBe(false);
    expect(parseDeckComboGraph({ ...graph, flow: payload }).positions["hand-1"]).toEqual(graph.positions?.["hand-1"]);
    const end = placeCardAt(blankDeckComboGraph("row-1"), { id: 3, name: "Boss" }, { x: 420, y: 452 }, "end-1");
    expect(end.nodes.find((node) => node.id === "end-1")?.lane).toBe("spell");
  });

  it("snaps the dragged card's top-left into the leftmost slot", () => {
    const cursor = { x: 190, y: 90 };
    const grabbed = cardDropScreenPoint(cursor, { x: 70, y: 48 });
    const fromCursor = placeCardAt(blankDeckComboGraph("row-1"), { id: 1, name: "Starter" }, cursor, "hand-cursor");
    const fromCard = placeCardAt(blankDeckComboGraph("row-1"), { id: 1, name: "Starter" }, grabbed, "hand-card");
    expect(fromCursor.positions?.["hand-cursor"]?.x).toBe(FLOW_ORIGIN_X + COMBO_FLOW_COL);
    expect(fromCard.positions?.["hand-card"]?.x).toBe(80);
  });

  it("keeps the handles a player drew, including bottom to top between neighbors", () => {
    let graph = placeCardAt(blankDeckComboGraph("row-1"), { id: 1, name: "Left" }, { x: 80, y: 40 }, "left");
    graph = placeCardAt(graph, { id: 2, name: "Right" }, { x: 200, y: 40 }, "right");
    const linked = addComboLink(graph, "left", "right", "play", { fromSide: "bottom", toSide: "top" });
    expect(linked.graph.edges[0]).toMatchObject({ fromSide: "bottom", toSide: "top" });
    const withInterrupt = {
      ...linked.graph,
      edges: [...linked.graph.edges, { from: "left", to: "right", relation: "interrupts" as const }],
    };
    const removed = removeComboLink(withInterrupt, "left", "right", "play");
    expect(removed.edges).toEqual([{ from: "left", to: "right", relation: "interrupts" }]);
    expect(removed.nodes.map((node) => node.id)).toEqual(["left", "right"]);
  });

  it("spreads cards that were saved on a tighter column stride", () => {
    const graph = placeCardAt(blankDeckComboGraph("row-1"), { id: 1, name: "Left" }, { x: 80, y: 40 }, "left");
    const tight = placeCardAt(graph, { id: 2, name: "Right" }, { x: 200, y: 40 }, "right");
    tight.positions = {
      ...tight.positions,
      right: { x: FLOW_ORIGIN_X + 116, y: tight.positions?.right?.y ?? 28 },
    };
    const spread = reflowBoardColumns(tight);
    expect(spread.positions?.left?.x).toBe(FLOW_ORIGIN_X);
    expect(spread.positions?.right?.x).toBe(FLOW_ORIGIN_X + COMBO_FLOW_COL);
  });

  it("widens an end-board zone so a second card sits beside the first", () => {
    let graph = placeCardAt(blankDeckComboGraph("row-1"), { id: 1, name: "Boss A" }, { x: 90, y: 452 }, "boss-a");
    graph = placeCardAt(graph, { id: 2, name: "Boss B" }, { x: 200, y: 452 }, "boss-b");
    expect(graph.positions?.["boss-a"]).toMatchObject({ x: 80 });
    expect(graph.positions?.["boss-b"]).toMatchObject({ x: FLOW_ORIGIN_X + COMBO_FLOW_COL });
    const frames = endZoneFrames(graph);
    expect(frames[0]?.width).toBeGreaterThan(148);
    expect(frames[1]?.x).toBeGreaterThan(244);
    graph = placeCardAt(graph, { id: 3, name: "Material" }, { x: frames[1].x + 20, y: 452 }, "mat-1");
    expect(graph.nodes.find((node) => node.id === "mat-1")?.lane).toBe("material");
    expect(graph.positions?.["mat-1"]?.x).toBe(endZoneFrames(graph)[1]?.x);
  });
});

describe("stored combo board file", () => {
  it("keeps the board document and drops derived interruption data", () => {
    const graph = toggleNodeDisruption(
      addCardToGraph(blankDeckComboGraph("row-1"), { kind: "play", rowId: "row-1" }, { id: 10, name: "Snake-Eye Ash" }, "step-1"),
      "step-1",
    );
    const stored = storedBoardGraph({
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id: "ash-node",
          label: "Ash",
          cardName: "Ash Blossom & Joyous Spring",
          cardIds: [99],
          kind: "interruption",
          lane: "interrupt",
          order: 0,
        },
      ],
      edges: [...graph.edges, { from: "ash-node", to: "step-1", relation: "interrupts" }],
    });
    expect(stored.nodes.map((node) => node.id)).toEqual(["step-1"]);
    expect(stored.edges).toEqual([]);
    expect(stored.disruptedNodeIds).toEqual(["step-1"]);
    expect(stored).not.toHaveProperty("flow");
    expect(JSON.stringify(stored)).not.toMatch(/Ash Blossom/);
  });
});

describe("deck_combo_lines migration", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261029003009_deck_combo_lines.sql"),
    "utf8",
  );

  it("stores one graph per deck-owned line and locks it to the signed-in user", () => {
    expect(sql).toContain("create table public.deck_combo_lines");
    expect(sql).toContain("deck_id uuid not null references public.decks (id) on delete cascade");
    expect(sql).toContain("user_id uuid not null references auth.users (id) on delete cascade");
    expect(sql).toContain("graph jsonb not null");
    expect(sql).toContain("user_id = auth.uid()");
    expect(sql).toContain("decks.user_id = auth.uid()");
  });
});

describe("Ash Blossom text matcher", () => {
  it("flags deck search, deck special summon, and deck to graveyard", () => {
    expect(ashClauseForText('Add 1 "Snake-Eye" monster from your Deck to your hand.')).toBe("add");
    expect(ashClauseForText('Special Summon 1 "Purrely" monster from your Deck.')).toBe("special");
    expect(ashClauseForText("You can send 1 card from your Deck to the GY.")).toBe("send");
  });

  it("does not flag Extra Deck summons, Ash's own text, or a graveyard special summon", () => {
    expect(ashClauseForText("You cannot Special Summon monsters from the Extra Deck, except DARK Dragon Synchro Monsters.")).toBeNull();
    expect(
      ashClauseForText(
        'When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that effect. Add a card from the Deck to the hand. Special Summon from the Deck. Send a card from the Deck to the GY.',
      ),
    ).toBeNull();
    expect(
      ashClauseForText(
        'When this card is Synchro Summoned: You can target 1 "Resonator" monster in your GY; Special Summon it. You cannot Special Summon monsters from the Extra Deck the turn you activate this effect, except DARK Dragon Synchro Monsters.',
      ),
    ).toBeNull();
  });

  it("does not flag a beater or Infinite Impermanence", () => {
    expect(ashClauseForText("A dragon of light that attacks with a shining body.")).toBeNull();
    expect(
      ashClauseForText(
        "Target 1 face-up monster your opponent controls; negate its effects (until the end of this turn), then, if this card was Set before activation and is on the field at resolution, for the rest of this turn all other Spell/Trap effects in this column are negated.",
      ),
    ).toBeNull();
  });

  it("attaches a warning to the placed step and not to the end board", () => {
    const cards = new Map<number, { desc: string }>([
      [10, { desc: 'Add 1 card from your Deck to your hand.' }],
      [11, { desc: 'Add 1 card from your Deck to your hand.' }],
    ]);
    const warnings = ashWarningsForSteps(
      [
        { id: "play", kind: "step", lane: "play", cardIds: [10] },
        { id: "boss", kind: "endboard", lane: "boss", cardIds: [11] },
      ],
      cards,
    );
    expect(warnings.map((warning) => warning.stepNodeId)).toEqual(["play"]);
  });
});
