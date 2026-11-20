/**
 * @jest-environment jsdom
 */
import { webcrypto } from "node:crypto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorialUserMenu } from "@/components/mda/editorial-user-menu";

const mockSignOut = jest.fn().mockResolvedValue({ error: null });

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

jest.mock("next/navigation", () => ({
  usePathname: () => "/deck-archives",
}));

jest.mock("@/context/deck-context", () => ({
  useDeck: () => ({ currentDeck: { id: "deck-1", deckFormat: "Master Duel" } }),
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
      user: { email: string; user_metadata?: { name?: string } } | null;
    }) => unknown,
  ) =>
    selector({
      user: {
        email: "duelist@example.com",
        user_metadata: { name: "Brandin" },
      },
    }),
}));

describe("EditorialUserMenu", () => {
  beforeEach(() => {
    mockSignOut.mockClear();
  });

  it("opens an editorial menu with the signed-in email and logout", async () => {
    const user = userEvent.setup();
    render(<EditorialUserMenu />);

    const trigger = screen.getByRole("button", { name: "User menu" });
    expect(trigger).toHaveTextContent("B");
    expect(trigger.className).toContain("bg-[#14181f]");

    await user.click(trigger);

    expect(await screen.findByText("duelist@example.com")).toBeInTheDocument();
    const help = screen.getByRole("menuitem", { name: /help/i });
    expect(help).not.toHaveAttribute("data-disabled");
    await user.click(screen.getByRole("menuitem", { name: /logout/i }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);

    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: /help/i }));
    expect(await screen.findByRole("dialog", { name: "Help" })).toBeInTheDocument();
  });
});
