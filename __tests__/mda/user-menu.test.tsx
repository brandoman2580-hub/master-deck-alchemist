/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/components/ui/user-menu";

const mockSignOut = jest.fn().mockResolvedValue({ error: null });

jest.mock("next/navigation", () => ({
  usePathname: () => "/workshop",
}));

jest.mock("@/context/deck-context", () => ({
  useDeck: () => ({ currentDeck: { id: "deck-1", deckFormat: "TCG" } }),
}));

jest.mock("@/app/help/actions", () => ({
  sendFeedback: jest.fn(),
}));

jest.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: () => mockSignOut(),
    },
  }),
}));

jest.mock("@/store/useUserStore", () => ({
  useUserStore: (
    selector: (state: {
      user: { email: string; user_metadata?: { name?: string } };
    }) => unknown,
  ) =>
    selector({
      user: {
        email: "duelist@example.com",
        user_metadata: { name: "Brandin" },
      },
    }),
}));

describe("UserMenu", () => {
  beforeEach(() => {
    mockSignOut.mockClear();
  });

  it("opens a glass menu with magnetic items above page chrome", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    const trigger = screen.getByRole("button", { name: "User menu" });
    expect(trigger).toHaveAttribute("data-magnetic");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    const menu = document.querySelector("[data-mda-user-menu]");
    expect(menu).toBeInTheDocument();
    // Below magnetic cursor (z≈10000) so the morph ring paints above the glass.
    expect(menu?.className).toMatch(/z-\[1000\]/);
    expect(trigger.className).toContain("border-mda-cyan");
    expect(menu?.querySelector("[data-mda-glass-popover]")).toBeInTheDocument();
    expect(menu?.querySelector("[data-mda-glass-surface]")).toBeInTheDocument();

    const logout = screen.getByRole("menuitem", { name: /logout/i });
    expect(logout).toHaveAttribute("data-magnetic");
    expect(screen.getByRole("menuitem", { name: /help/i })).toBeEnabled();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
