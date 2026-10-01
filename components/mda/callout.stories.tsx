import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MdaCallout } from "./callout";

const meta = {
  title: "MDA/Atoms/Callout",
  component: MdaCallout,
  tags: ["autodocs"],
} satisfies Meta<typeof MdaCallout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Left: Story = {
  args: {
    label: "Landing / Share only",
    description: "Callout leaders stay off the Workshop binder grid.",
    side: "left",
  },
};

export const Right: Story = {
  args: {
    label: "Share import",
    description: "Preview deck before opening Workshop.",
    side: "right",
  },
};
