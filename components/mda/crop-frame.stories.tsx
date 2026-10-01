import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MdaCropFrame } from "./crop-frame";

const meta = {
  title: "MDA/Atoms/CropFrame",
  component: MdaCropFrame,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof MdaCropFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    grid: false,
    children: (
      <div className="min-h-[160px] bg-mda-surface p-6 font-mda text-sm text-mda-ink">
        Command shell content
      </div>
    ),
  },
};

export const WithGrid: Story = {
  args: {
    grid: true,
    children: (
      <div className="min-h-[160px] p-6 font-mda text-sm text-mda-ink">
        Grid watermark command shell
      </div>
    ),
  },
};
