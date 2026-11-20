/**
 * @jest-environment jsdom
 */
import { webcrypto } from "node:crypto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { HelpDialog } from "@/components/mda/help/help-dialog";
import { FEEDBACK_INITIAL_STATE } from "@/lib/help/feedback";

expect.extend(toHaveNoViolations);

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

const sendFeedback = jest.fn(async () => FEEDBACK_INITIAL_STATE);

jest.mock("@/app/help/actions", () => ({
  sendFeedback: (...args: unknown[]) => sendFeedback(...args),
}));

describe("HelpDialog", () => {
  it("opens answers without axe violations, then the report form", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HelpDialog
        open
        onOpenChange={jest.fn()}
        pathname="/share/secret-token"
        deckId="deck-1"
        deckFormat="Master Duel"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Help" })).toBeInTheDocument();
    expect(screen.getByText("Where a deck opens")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("tab", { name: "Report" }));
    expect(screen.getByRole("radio", { name: "Bug" })).toBeInTheDocument();
    expect(screen.getByLabelText("What happened")).toBeInTheDocument();
    expect(screen.getByLabelText(/Screenshot, optional/)).toBeInTheDocument();
    expect(screen.getByText(/smaller than 2 MB/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Include diagnostics/)).toBeChecked();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows an error summary and keeps the typed message when the category is missing", async () => {
    const user = userEvent.setup();
    render(
      <HelpDialog open onOpenChange={jest.fn()} pathname="/deck-archives" />,
    );
    await user.click(screen.getByRole("tab", { name: "Report" }));
    await user.type(screen.getByLabelText("What happened"), "Search kept the old query.");
    await user.click(screen.getByRole("button", { name: "Send report" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Select a category.");
    expect(screen.getByLabelText("What happened")).toHaveValue("Search kept the old query.");
    expect(sendFeedback).not.toHaveBeenCalled();
  });
});
