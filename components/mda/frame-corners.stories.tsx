import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MdaFrameCorners } from "./frame-corners";

const meta = {
  title: "MDA/Atoms/FrameCorners",
  component: MdaFrameCorners,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="relative h-32 w-56 border border-mda-panel bg-mda-surface p-4">
        <Story />
        <span className="font-mda text-xs uppercase tracking-wider text-mda-ink">
          Bezel sample
        </span>
      </div>
    ),
  ],
} satisfies Meta<typeof MdaFrameCorners>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Quiet: Story = { args: { variant: "quiet" } };
export const Selected: Story = { args: { variant: "selected" } };
export const Command: Story = { args: { variant: "command" } };
