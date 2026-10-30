import { layoutBuilderBoard, layoutComboBoard } from "@/components/mda/combo-board-layout";
import type { ComboLine } from "@/lib/engine";

const purrely: ComboLine = {
  id: "purrely",
  name: "Purrely Sleepy Memory Line",
  killers: ["Ash Blossom & Joyous Spring", "Infinite Impermanence"],
  endboardSummary: "Expurrely Noir after Purrelyeap!?",
  nodes: [
    { id: "h-friend", label: "Friend", cardName: "My Friend Purrely", cardIds: [1], kind: "hand", lane: "hand", order: 0 },
    { id: "p-friend", label: "Friend", cardName: "My Friend Purrely", cardIds: [1], kind: "step", lane: "play", order: 0 },
    { id: "p-noir", label: "Noir", cardName: "Epurrely Noir", cardIds: [2], kind: "step", lane: "play", order: 1 },
    { id: "i-ash", label: "Ash", cardName: "Ash Blossom & Joyous Spring", cardIds: [], kind: "interruption", lane: "interrupt", order: 0 },
    { id: "b-noir", label: "Boss", cardName: "Expurrely Noir", cardIds: [3], kind: "endboard", lane: "boss", order: 0 },
    { id: "m-sleepy", label: "Sleepy", cardName: "Purrely Sleepy Memory", cardIds: [4], kind: "endboard", lane: "material", order: 0 },
  ],
  edges: [
    { from: "h-friend", to: "p-friend", relation: "play" },
    { from: "p-friend", to: "p-noir", relation: "play" },
    { from: "i-ash", to: "p-friend", relation: "interrupts" },
    { from: "m-sleepy", to: "b-noir", relation: "material" },
  ],
};

describe("layoutComboBoard", () => {
  it("aligns an interruption under the play card it stops", () => {
    const layout = layoutComboBoard(purrely);
    const ash = layout.nodes.find((node) => node.id === "i-ash");
    const friend = layout.nodes.find((node) => node.id === "p-friend");
    expect(ash).toBeDefined();
    expect(friend).toBeDefined();
    expect(ash!.x).toBe(friend!.x);
    expect(ash!.y).toBeGreaterThan(friend!.y);
  });

  it("draws a material connector onto the boss", () => {
    const layout = layoutComboBoard(purrely);
    const material = layout.edges.find((edge) => edge.relation === "material");
    expect(material?.from).toBe("m-sleepy");
    expect(material?.to).toBe("b-noir");
    expect(material?.d.startsWith("M ")).toBe(true);
  });

  it("keeps an empty marker for end-board lanes with no cards", () => {
    const layout = layoutComboBoard(purrely);
    expect(layout.labels.some((label) => label.id === "empty-trap" && label.text === "—")).toBe(true);
    expect(layout.labels.some((label) => label.id === "empty-banish")).toBe(true);
    expect(layout.nodes.some((node) => node.lane === "boss")).toBe(true);
  });
});

describe("layoutBuilderBoard", () => {
  it("keeps a later play row above the end board and hangs Ash under that step", () => {
    const layout = layoutBuilderBoard({
      playRows: [{ id: "row-1" }, { id: "row-2" }],
      warnings: [
        {
          trapName: "Ash Blossom & Joyous Spring",
          clause: "add",
          stepNodeId: "step-2",
        },
      ],
      nodes: [
        {
          id: "step-2",
          label: "Search",
          cardName: "Snake-Eye Ash",
          cardIds: [10],
          kind: "step",
          lane: "play",
          rowId: "row-2",
          order: 0,
        },
        {
          id: "boss",
          label: "Boss",
          cardName: "Diabellstar",
          cardIds: [11],
          kind: "endboard",
          lane: "boss",
          order: 0,
        },
      ],
      edges: [],
      missingNodeIds: new Set(["boss"]),
    });
    const play2 = layout.labels.find((label) => label.text === "Play 2");
    const end = layout.labels.find((label) => label.id === "label-end");
    const ash = layout.nodes.find((node) => node.id === "ash-step-2");
    const step = layout.nodes.find((node) => node.id === "step-2");
    const boss = layout.nodes.find((node) => node.id === "boss");
    expect(play2).toBeDefined();
    expect(end).toBeDefined();
    expect(play2!.y).toBeLessThan(end!.y);
    expect(ash?.x).toBe(step?.x);
    expect(ash && step ? ash.y : 0).toBeGreaterThan(step?.y ?? 0);
    expect(boss?.missing).toBe(true);
    expect(layout.labels[0]?.text).toBe("Opening hand");
    expect(layout.insertSlots.map((slot) => slot.label)).toEqual([
      "Add row below opening hand",
      "Add row below play 1",
      "Add row below play 2",
    ]);
    expect(layout.insertSlots.some((slot) => slot.y > (end?.y ?? 0))).toBe(false);
  });

  it("draws a stored link from the card edges the player chose", () => {
    const layout = layoutBuilderBoard({
      playRows: [{ id: "row-1" }],
      warnings: [],
      nodes: [
        {
          id: "hand-1",
          label: "Hand",
          cardName: "Snake-Eye Ash",
          cardIds: [10],
          kind: "hand",
          lane: "hand",
          order: 0,
        },
        {
          id: "step-1",
          label: "Play",
          cardName: "Snake-Eye Oak",
          cardIds: [12],
          kind: "step",
          lane: "play",
          rowId: "row-1",
          order: 0,
        },
      ],
      edges: [{ from: "hand-1", to: "step-1", relation: "play", fromSide: "bottom", toSide: "top" }],
    });
    const from = layout.nodes.find((node) => node.id === "hand-1");
    const edge = layout.edges.find((item) => item.from === "hand-1");
    expect(from).toBeDefined();
    expect(edge?.d.startsWith(`M ${from!.x + from!.width / 2} ${from!.y + from!.height}`)).toBe(true);
  });
});
