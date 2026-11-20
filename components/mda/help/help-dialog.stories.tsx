import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HelpDialog } from "./help-dialog";

const meta = {
  title: "MDA/Organisms/HelpDialog",
  component: HelpDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: () => undefined,
    pathname: "/workshop",
    deckId: "deck-1",
    deckFormat: "Master Duel",
  },
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "mda-inverse" },
  },
} satisfies Meta<typeof HelpDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Answers: Story = {};

export const Report: Story = {
  play: async ({ canvasElement }) => {
    const { userEvent, within } = await import("storybook/test");
    const canvas = within(canvasElement.parentElement ?? canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Report" }));
  },
};
