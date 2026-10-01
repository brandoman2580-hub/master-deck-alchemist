import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ClipButton } from "./clip-button";

const meta = {
  title: "MDA/Atoms/ClipButton",
  component: ClipButton,
  tags: ["autodocs"],
  args: { onClick: fn(), children: "New deck" },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "filled",
        "ghost",
        "surface",
        "heroLogin",
        "heroPreview",
        "headerLogin",
        "authSubmit",
        "hazard",
      ],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof ClipButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = { args: { variant: "filled" } };
export const TechCut: Story = { args: { variant: "filled", techCut: true } };
export const Hazard: Story = {
  args: { variant: "hazard", techCut: true, children: "Warning" },
};
export const Ghost: Story = { args: { variant: "ghost", children: "Cancel" } };
export const Small: Story = { args: { size: "sm", children: "Details" } };

export const Clicks: Story = {
  args: { variant: "filled", children: "Confirm" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Confirm" }));
    await expect(args.onClick).toHaveBeenCalled();
  },
};
