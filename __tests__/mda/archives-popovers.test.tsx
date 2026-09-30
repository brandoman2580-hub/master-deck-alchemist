import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeckArchiveActionPopovers } from "@/components/mda/archives-popovers";

describe("DeckArchiveActionPopovers share flow", () => {
  it("keeps the share menu open and blocks re-entry while generating a link", async () => {
    const user = userEvent.setup();
    let resolveShare: ((url: string) => void) | undefined;
    const onShareOpen = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveShare = resolve;
        }),
    );

    render(
      <DeckArchiveActionPopovers
        deckName="Test Deck"
        deckFormat="Master Duel"
        onCopyConfirm={jest.fn()}
        onRenameConfirm={jest.fn()}
        onDeleteConfirm={jest.fn()}
        onShareOpen={onShareOpen}
      />,
    );

    const shareButton = screen.getByRole("button", { name: "Share Test Deck" });
    await user.click(shareButton);

    expect(onShareOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Generating share link…")).toBeInTheDocument();
    expect(shareButton).toBeDisabled();

    await user.click(shareButton);
    expect(onShareOpen).toHaveBeenCalledTimes(1);

    resolveShare?.("https://example.com/share/abc");
    await waitFor(() => {
      expect(screen.getByText("https://example.com/share/abc")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Show QR Code" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show QR Code" }));
    expect(
      screen.getByRole("button", { name: "Hide QR Code" }),
    ).toBeInTheDocument();

    expect(shareButton).not.toBeDisabled();
  });
});
