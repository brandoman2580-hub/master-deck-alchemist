import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Check, X } from "lucide-react";
import { MdaGlassPopover } from "./glass-popover";

const meta = {
  title: "MDA/Atoms/GlassPopover",
  component: MdaGlassPopover,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    backgrounds: { default: "mda-inverse" },
  },
  decorators: [
    (Story) => (
      <div className="bg-mda-inverse p-10">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MdaGlassPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyShell: Story = {
  args: {
    children: (
      <div className="min-w-[220px] p-3 font-mda text-xs uppercase tracking-wide text-mda-ink">
        Glass popover shell
      </div>
    ),
  },
};

export const RenameDeck: Story = {
  args: {
    children: (
      <div className="flex min-w-[220px] flex-col gap-2 p-3">
        <label className="font-mda text-xs font-bold uppercase tracking-wide text-mda-ink">
          Rename deck
        </label>
        <input
          readOnly
          value="Pure Darkness"
          className="border border-mda-ink/20 bg-mda-panel/80 px-2 py-1.5 font-mda text-sm text-mda-ink-strong outline-none"
        />
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            aria-label="Confirm rename"
            className="rounded p-2 text-mda-success"
          >
            <Check className="h-6 w-6" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Cancel rename"
            className="rounded p-2 text-mda-danger"
          >
            <X className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </div>
    ),
  },
};

export const CompactConfirm: Story = {
  args: {
    panelClassName: "px-4 py-3",
    children: (
      <div className="flex max-w-[360px] items-center gap-3">
        <p className="font-mda text-sm text-mda-ink">
          Delete <span className="font-bold">Pure Darkness</span>?
        </p>
        <button type="button" className="rounded p-2 text-mda-success">
          <Check className="h-6 w-6" aria-hidden />
        </button>
        <button type="button" className="rounded p-2 text-mda-danger">
          <X className="h-6 w-6" aria-hidden />
        </button>
      </div>
    ),
  },
};
