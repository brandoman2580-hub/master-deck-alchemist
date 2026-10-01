import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MdaHazardStripe } from "./hazard-stripe";

const meta = {
  title: "MDA/Atoms/HazardStripe",
  component: MdaHazardStripe,
  tags: ["autodocs"],
} satisfies Meta<typeof MdaHazardStripe>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Banlist advisory · limited cards present",
  },
};

export const Large: Story = {
  args: {
    label: "Hard cap reached",
    size: "md",
  },
};
