/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { MdaGlassPopover } from "@/components/mda/glass-popover";
import { DeckArchiveActionPopovers } from "@/components/mda/archives-popovers";

expect.extend(toHaveNoViolations);

describe("MdaGlassPopover", () => {
  it("uses card-preview glass classes and edge sky L-brackets", () => {
    const { container } = render(
      <MdaGlassPopover panelClassName="p-3">
        <p>Popover body</p>
      </MdaGlassPopover>,
    );

    expect(
      container.querySelector("[data-mda-glass-popover]"),
    ).toBeInTheDocument();

    const surface = container.querySelector("[data-mda-glass-surface]");
    expect(surface).toBeInTheDocument();
    expect(surface?.className).toMatch(/bg-\[rgba\(247,251,253,0\.3\)\]/);
    expect(surface?.className).not.toMatch(/border-2/);
    expect(surface?.className).toMatch(/backdrop-blur-\[12px\]/);
    expect(surface?.className).toMatch(/backdrop-saturate-\[1\.6\]/);
    expect(surface?.className).toMatch(/shadow-mda-lift/);
    const arms = container.querySelectorAll(".mda-l-arm");
    expect(arms).toHaveLength(4);
    expect(container.querySelector(".mda-l-frame")).toBeInTheDocument();
    expect(container.querySelector(".size-6")).not.toBeInTheDocument();
    expect(screen.getByText("Popover body")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <MdaGlassPopover>
        <label htmlFor="name">Name</label>
        <input id="name" defaultValue="Pure Darkness" />
      </MdaGlassPopover>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("DeckArchiveActionPopovers rename shell", () => {
  it("opens rename contents inside glass popover", async () => {
    const user = userEvent.setup();
    const onRenameConfirm = jest.fn();

    const { container } = render(
      <DeckArchiveActionPopovers
        deckName="Pure Darkness"
        deckFormat="Master Duel"
        onCopyConfirm={jest.fn()}
        onRenameConfirm={onRenameConfirm}
        onDeleteConfirm={jest.fn()}
        onShareOpen={jest.fn().mockResolvedValue("https://example.com/share/x")}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Rename Pure Darkness" }),
    );

    const input = await screen.findByRole("textbox", { name: /rename deck/i });
    expect(input).toHaveValue("Pure Darkness");
    expect(
      container.ownerDocument.querySelector("[data-mda-glass-popover]"),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "Shadow Realm");
    await user.click(screen.getByRole("button", { name: "Confirm rename" }));
    await waitFor(() => {
      expect(onRenameConfirm).toHaveBeenCalledWith("Shadow Realm");
    });
  });
});
