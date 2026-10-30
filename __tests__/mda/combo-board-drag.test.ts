import type { Node } from "@xyflow/react";
import { cardOverlapsPool, ghostFrame, holdDraggedCard } from "@/components/mda/combo-board";

function node(id: string, x: number, y: number): Node {
  return { id, position: { x, y }, data: { label: id } };
}

describe("holdDraggedCard", () => {
  it("keeps the moving card at the pointer when the layout rebuilds", () => {
    const layout = [node("hand-0", 80, 28), node("play-0", 80, 240)];
    const held = holdDraggedCard(layout, { id: "hand-0", position: { x: 410, y: 160 } });

    expect(held[0]?.position).toEqual({ x: 410, y: 160 });
    expect(held[0]?.dragging).toBe(true);
    expect(held[1]).toBe(layout[1]);
  });

  it("returns the layout unchanged when nothing is being dragged", () => {
    const layout = [node("hand-0", 80, 28)];
    expect(holdDraggedCard(layout, null)).toBe(layout);
  });
});

describe("cardOverlapsPool", () => {
  const pool = { left: 25, top: 330, right: 313, bottom: 1200 };

  it("is true when the card crosses into the deck list", () => {
    expect(cardOverlapsPool({ left: 280, top: 640, right: 376, bottom: 780 }, pool)).toBe(true);
  });

  it("is false while the card is still on the canvas", () => {
    expect(cardOverlapsPool({ left: 410, top: 640, right: 506, bottom: 780 }, pool)).toBe(false);
    expect(cardOverlapsPool({ left: 280, top: 640, right: 376, bottom: 780 }, null)).toBe(false);
  });
});

describe("ghostFrame", () => {
  const pool = { left: 25, top: 330, right: 313, bottom: 1200 };
  const grab = { x: 30, y: 40, width: 96, height: 140 };

  it("follows the pointer onto the deck list", () => {
    const frame = ghostFrame({ x: 200, y: 700 }, grab, pool);
    expect(frame).toMatchObject({ left: 170, top: 660, width: 96, height: 140, visible: true });
  });

  it("stays hidden while the pointer card is still on the canvas", () => {
    expect(ghostFrame({ x: 500, y: 700 }, grab, pool).visible).toBe(false);
  });
});
