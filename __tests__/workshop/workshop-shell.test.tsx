import { useState, type ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { WorkshopShell } from "@/app/workshop/workshop-shell";

expect.extend(toHaveNoViolations);

const pillars = [
  { label: "Consistency", value: 82 },
  { label: "Power", value: 79 },
  { label: "Resilience", value: 74 },
  { label: "Disruption", value: 68 },
];

function renderShell(overrides: Partial<ComponentProps<typeof WorkshopShell>> = {}) {
  const onRename = jest.fn();
  const onBackToArchives = jest.fn();
  const onTabChange = jest.fn();
  render(
    <WorkshopShell
      deckName="Branded Despia"
      deckFormat="TCG"
      mainCount={40}
      extraCount={15}
      sideCount={15}
      coverCard={null}
      gradeLetter="B"
      pillars={pillars}
      gradeLoading={false}
      banlistFault={false}
      tab="build"
      onTabChange={onTabChange}
      onBackToArchives={onBackToArchives}
      onRename={onRename}
      {...overrides}
    >
      <p>Sheet body</p>
    </WorkshopShell>,
  );
  return { onRename, onBackToArchives, onTabChange };
}

describe("WorkshopShell", () => {
  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <WorkshopShell
        deckName="Branded Despia"
        deckFormat="TCG"
        mainCount={40}
        extraCount={15}
        sideCount={15}
        coverCard={null}
        gradeLetter="B"
        pillars={pillars}
        gradeLoading={false}
        banlistFault
        tab="build"
        onTabChange={jest.fn()}
        onBackToArchives={jest.fn()}
        onRename={jest.fn()}
      >
        <p>Sheet body</p>
      </WorkshopShell>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows TCG side count and hides it for Master Duel", () => {
    const { unmount } = render(
      <WorkshopShell
        deckName="Branded Despia"
        deckFormat="TCG"
        mainCount={40}
        extraCount={15}
        sideCount={12}
        coverCard={null}
        gradeLetter="B"
        pillars={pillars}
        gradeLoading={false}
        banlistFault={false}
        tab="build"
        onTabChange={jest.fn()}
        onBackToArchives={jest.fn()}
        onRename={jest.fn()}
      >
        <p>Sheet body</p>
      </WorkshopShell>,
    );
    expect(screen.getByText("Side")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    unmount();

    renderShell({ deckFormat: "Master Duel", sideCount: 12 });
    expect(screen.getByText("MASTER DUEL")).toBeInTheDocument();
    expect(screen.queryByText("Side")).not.toBeInTheDocument();
  });

  it("shows the banlist warning only when the deck has a fault", () => {
    renderShell();
    expect(screen.queryByRole("img", { name: "Banlist fault" })).not.toBeInTheDocument();
    cleanup();
    renderShell({ banlistFault: true });
    expect(screen.getByRole("img", { name: "Banlist fault" })).toBeInTheDocument();
  });

  it("commits a renamed deck on Enter and cancels on Escape", () => {
    const { onRename } = renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Edit deck name" }));
    const field = screen.getByRole("textbox", { name: "Deck name" });
    fireEvent.change(field, { target: { value: "Despia Endboard" } });
    act(() => {
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      field.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    });
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith("Despia Endboard");

    fireEvent.click(screen.getByRole("button", { name: "Edit deck name" }));
    const again = screen.getByRole("textbox", { name: "Deck name" });
    fireEvent.change(again, { target: { value: "Discarded" } });
    act(() => {
      again.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      again.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    });
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Branded Despia" })).toBeInTheDocument();
  });

  it("commits a renamed deck when the field loses focus", () => {
    const { onRename } = renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Edit deck name" }));
    const field = screen.getByRole("textbox", { name: "Deck name" });
    fireEvent.change(field, { target: { value: "Branded Opening" } });
    fireEvent.blur(field);
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith("Branded Opening");
  });

  it("draws each pillar on a shared track and clears the marks while loading", () => {
    renderShell();
    const consistency = screen.getByText("Consistency").parentElement;
    expect(consistency?.querySelector("[data-grade-mark]")).toHaveStyle({
      transform: "scaleX(0.82)",
    });
    expect(consistency?.parentElement).toHaveClass("flex-1");
    expect(screen.getByText("82")).toBeInTheDocument();
    cleanup();

    renderShell({ gradeLoading: true });
    expect(screen.getByText("Consistency").parentElement?.querySelector("[data-grade-mark]")).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("explains the score and returns focus to the link", () => {
    renderShell();
    const link = screen.getByRole("button", { name: "What this score means" });
    fireEvent.click(link);
    expect(screen.getByRole("dialog", { name: "What this score means" })).toBeInTheDocument();
    expect(screen.getByText(/not a win rate/i)).toBeInTheDocument();
    expect(screen.getByText(/one interruption/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(link).toHaveFocus();
  });

  it("returns to Archives and moves between modes from the keyboard", () => {
    const onBackToArchives = jest.fn();
    function Harness() {
      const [tab, setTab] = useState<"build" | "matchups" | "combos">("build");
      return (
        <WorkshopShell
          deckName="Branded Despia"
          deckFormat="TCG"
          mainCount={40}
          extraCount={15}
          sideCount={15}
          coverCard={null}
          gradeLetter="B"
          pillars={pillars}
          gradeLoading={false}
          banlistFault={false}
          tab={tab}
          onTabChange={setTab}
          onBackToArchives={onBackToArchives}
          onRename={jest.fn()}
        >
          <p>Sheet body</p>
        </WorkshopShell>
      );
    }
    render(<Harness />);
    const session = screen.getByRole("region", { name: "Deck session" });
    expect(session).toContainElement(screen.getByRole("tablist", { name: "Workshop mode" }));
    expect(session).toContainElement(screen.getByText("Grade"));
    const build = screen.getByRole("tab", { name: "Build" });
    expect(build.querySelector("[aria-hidden='true']")).toHaveClass("absolute", "inset-x-0", "bottom-0", "h-0.5", "bg-[#bfe5f3]");
    expect(screen.getByRole("tab", { name: "Matchups" }).querySelector("[aria-hidden='true']")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Archives" }));
    expect(onBackToArchives).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Build" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Matchups" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Matchups" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Combos" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Combos" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "Build" })).toHaveFocus();
    expect(screen.getAllByText("Sheet body").length).toBeGreaterThan(0);
  });
});
