import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MdaLoaderMark, MdaLoadingScreen } from "./mda-loading-screen";

const meta = {
  title: "MDA/Atoms/Loaders",
  component: MdaLoaderMark,
  tags: ["autodocs"],
  args: { variant: "quad" },
} satisfies Meta<typeof MdaLoaderMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Production default (Phase 2a pick). */
export const DefaultQuad: Story = { args: { variant: "quad" } };
export const LegacyMark: Story = { args: { variant: "legacy" } };
export const WaveformMark: Story = { args: { variant: "waveform" } };

export const OverlayQuad: StoryObj<typeof MdaLoadingScreen> = {
  render: () => (
    <div className="relative h-64 w-[420px] overflow-hidden border border-mda-bezel/30">
      <MdaLoadingScreen open scoped variant="quad" status="Syncing archives…" />
    </div>
  ),
};

export const OverlayLegacy: StoryObj<typeof MdaLoadingScreen> = {
  render: () => (
    <div className="relative h-64 w-[420px] overflow-hidden border border-mda-bezel/30">
      <MdaLoadingScreen
        open
        scoped
        variant="legacy"
        status="Loading card library…"
      />
    </div>
  ),
};

export const OverlayWaveform: StoryObj<typeof MdaLoadingScreen> = {
  render: () => (
    <div className="relative h-64 w-[420px] overflow-hidden border border-mda-bezel/30">
      <MdaLoadingScreen
        open
        scoped
        variant="waveform"
        status="Computing facts…"
      />
    </div>
  ),
};
