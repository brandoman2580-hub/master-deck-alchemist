import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MdaSegmentedBar } from "./segmented-bar";

const meta = {
  title: "MDA/Atoms/SegmentedBar",
  component: MdaSegmentedBar,
  tags: ["autodocs"],
} satisfies Meta<typeof MdaSegmentedBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Consistency",
    value: 7,
    segments: 10,
  },
};

export const HazardTone: Story = {
  args: {
    label: "Quota remaining",
    value: 2,
    segments: 8,
    tone: "hazard",
  },
};

export const Vertical: Story = {
  args: {
    label: "Axis",
    value: 5,
    segments: 8,
    orientation: "vertical",
  },
};
