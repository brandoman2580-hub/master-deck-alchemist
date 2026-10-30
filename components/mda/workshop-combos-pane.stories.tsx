import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { WorkshopCombosPane, type WorkshopComboLineView } from "./workshop-combos-pane";
import type { DeckCard } from "@/types/deck";
import "@/app/workshop/space-grotesk.css";

function card(id: number, name: string, desc: string): DeckCard {
  return {
    id,
    name,
    type: "Effect Monster",
    desc,
    deckInstanceId: `inst-${id}`,
  } as DeckCard;
}

const searcher = card(1, "My Friend Purrely", 'Add 1 "Purrely" card from your Deck to your hand.');

function starter(): WorkshopComboLineView {
  return {
    id: "purrely",
    name: "Purrely Sleepy Memory Line",
    graph: {
      playRows: [{ id: "row-1" }],
      nodes: [
        {
          id: "p-friend",
          label: "Friend",
          cardName: "My Friend Purrely",
          cardIds: [1],
          kind: "step",
          lane: "play",
          rowId: "row-1",
          order: 0,
        },
      ],
      edges: [],
      endboardSummary: "Expurrely Noir after Purrelyeap!?",
    },
  };
}

function BuilderStory() {
  const [lines, setLines] = useState<WorkshopComboLineView[]>([starter()]);
  return (
    <div className="h-[720px] w-[960px] border border-[#28303b] bg-[#eef3f6] font-spaceGrotesk text-[#0c0e12]">
      <WorkshopCombosPane
        canSave
        cards={[searcher]}
        lines={lines}
        onCreate={() => undefined}
        onRename={() => undefined}
        onDelete={() => undefined}
        onChangeGraph={(id, graph) =>
          setLines((current) => current.map((line) => (line.id === id ? { ...line, graph } : line)))
        }
      />
    </div>
  );
}

const meta = {
  title: "MDA/Organisms/WorkshopCombosPane",
  component: WorkshopCombosPane,
  tags: ["autodocs"],
  args: {
    canSave: false,
    lines: [],
    cards: [],
    loading: false,
    error: null,
    onCreate: () => undefined,
    onRename: () => undefined,
    onDelete: () => undefined,
    onChangeGraph: () => undefined,
  },
} satisfies Meta<typeof WorkshopCombosPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SleepyMemoryLine: Story = {
  render: () => <BuilderStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Add a row below play 1" }));
    await expect(canvas.getByText("Play 2")).toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: "Purrely Sleepy Memory Line" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  },
};

export const Empty: Story = {};
