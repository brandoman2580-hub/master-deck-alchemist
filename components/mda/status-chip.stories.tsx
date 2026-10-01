import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MdaStatusChip } from "./status-chip";

const meta = {
  title: "MDA/Atoms/StatusChip",
  component: MdaStatusChip,
  tags: ["autodocs"],
} satisfies Meta<typeof MdaStatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ink: Story = { args: { children: "Soft cap", tone: "ink" } };
export const Hazard: Story = {
  args: { children: "Near hard cap", tone: "hazard" },
};
export const Success: Story = { args: { children: "Legal", tone: "success" } };
export const Danger: Story = { args: { children: "Banned", tone: "danger" } };
