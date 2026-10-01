/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { MdaHazardStripe } from "@/components/mda/hazard-stripe";
import { MdaSegmentedBar } from "@/components/mda/segmented-bar";
import { MdaStatusChip } from "@/components/mda/status-chip";
import { MdaCropFrame } from "@/components/mda/crop-frame";
import { MdaCallout } from "@/components/mda/callout";
import { MdaFrameCorners } from "@/components/mda/frame-corners";
import { ClipButton } from "@/components/mda/clip-button";
import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";

expect.extend(toHaveNoViolations);

describe("Phase 2a foundation atoms", () => {
  it("renders hazard stripe with readable label", () => {
    render(<MdaHazardStripe label="Limited cards present" />);
    expect(screen.getByText("Limited cards present")).toBeInTheDocument();
  });

  it("exposes segmented bar as a meter with clamped value", () => {
    render(
      <MdaSegmentedBar label="Consistency" value={12} segments={10} />,
    );
    const meter = screen.getByRole("meter", { name: "Consistency" });
    expect(meter).toHaveAttribute("aria-valuenow", "10");
    expect(meter).toHaveAttribute("aria-valuemax", "10");
  });

  it("renders status chip and tech-cut clip button", () => {
    render(
      <>
        <MdaStatusChip tone="hazard">Near hard cap</MdaStatusChip>
        <ClipButton techCut>New deck</ClipButton>
      </>,
    );
    expect(screen.getByText("Near hard cap")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New deck" })).toBeInTheDocument();
  });

  it("marks frame corners decorative and crop frame hosts children", () => {
    const { container } = render(
      <MdaCropFrame>
        <p>Shell content</p>
        <MdaFrameCorners variant="command" />
      </MdaCropFrame>,
    );
    expect(screen.getByText("Shell content")).toBeInTheDocument();
    expect(
      container.querySelector('[data-mda-bezel="command"]'),
    ).toBeInTheDocument();
  });

  it("renders callout label and description", () => {
    render(
      <MdaCallout label="Share import" description="Preview before workshop." />,
    );
    expect(screen.getByText("Share import")).toBeInTheDocument();
    expect(screen.getByText("Preview before workshop.")).toBeInTheDocument();
  });

    it("defaults to quad and announces loading overlay for each loader variant", () => {
    const { rerender } = render(
      <MdaLoadingScreen open status="Loading library…" />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading library…")).toBeInTheDocument();

    rerender(
      <MdaLoadingScreen open variant="legacy" status="Legacy rings…" />,
    );
    expect(screen.getByText("Legacy rings…")).toBeInTheDocument();

    rerender(
      <MdaLoadingScreen open variant="waveform" status="Waveform…" />,
    );
    expect(screen.getByText("Waveform…")).toBeInTheDocument();
  });

  it("has no axe violations on core atoms", async () => {
    const { container } = render(
      <div>
        <MdaHazardStripe label="Advisory" />
        <MdaSegmentedBar label="Grade axis" value={4} segments={8} />
        <MdaStatusChip>Soft cap</MdaStatusChip>
        <MdaCallout label="Landing" description="Callout sample." />
        <ClipButton>Confirm</ClipButton>
        <MdaLoadingScreen open scoped status="Busy…" variant="quad" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
