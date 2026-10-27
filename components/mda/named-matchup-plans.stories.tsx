import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NamedMatchupPlans } from "./named-matchup-plans";

const meta = {
  title: "MDA/Organisms/NamedMatchupPlans",
  component: NamedMatchupPlans,
  tags: ["autodocs"],
  args: {
    deckFormat: "Master Duel",
    userCards: [{ name: "Ash Blossom & Joyous Spring", zone: "main" }],
    lists: [
      {
        name: "Branded",
        tier: 3,
        cards: [
          { name: "Branded Fusion", copies: 1, zone: "main" },
          { name: "Fallen of Albaz", copies: 1, zone: "main" },
          { name: "Mirrorjade the Iceblade Dragon", copies: 1, zone: "extra" },
        ],
      },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-[960px] bg-[#B9BEBE]/50 p-4 text-mda-ink">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NamedMatchupPlans>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AgainstBranded: Story = {};

export const Empty: Story = {
  args: { lists: [] },
};
