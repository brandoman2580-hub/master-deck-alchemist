import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArchivesScreen } from "@/app/deck-archives/archives-screen";
import { loadDeck as loadPersistedDeck, saveDeck } from "@/lib/data/decks";
import { useUserDecks } from "@/hooks/useUserDecks";
import { useUserStore } from "@/store/useUserStore";
import { useDeck } from "@/context/deck-context";
import { useLiveDeckStore } from "@/store/liveDeckStore";
import type { ClientDeck, DeckCard } from "@/types/deck";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/hooks/useUserDecks", () => ({
  useUserDecks: jest.fn(),
}));

jest.mock("@/store/useUserStore", () => ({
  useUserStore: jest.fn(),
}));

jest.mock("@/context/deck-context", () => ({
  useDeck: jest.fn(),
}));

jest.mock("@/lib/data/decks", () => ({
  deleteDeck: jest.fn(),
  loadDeck: jest.fn(),
  saveDeck: jest.fn(),
  toggleDeckPin: jest.fn(),
}));

function card(name: string): DeckCard {
  return {
    id: 14558127,
    deckInstanceId: "instance-1",
    name,
    type: "Effect Monster",
    desc: "",
    race: "Zombie",
    attribute: "DARK",
    misc_info: [{ md_rarity: "" }],
    card_sets: {
      set_name: "",
      set_code: "",
      set_rarity: "",
      set_rarity_code: "",
      set_price: "",
    },
    card_images: [],
    card_prices: [
      {
        cardmarket_price: "",
        tcgplayer_price: "2.25",
        ebay_price: "",
        amazon_price: "",
      },
    ],
  };
}

const labrynth: ClientDeck = {
  id: "deck-labrynth",
  name: "Labrynth",
  mainDeck: [card("Ash Blossom & Joyous Spring")],
  extraDeck: [],
  sideDeck: [],
  updated_at: "2026-10-17T12:00:00.000Z",
  deckFormat: "TCG",
  isPinned: true,
};

describe("ArchivesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLiveDeckStore.setState({
      currentDeck: {
        id: "not-open",
        name: "New Deck",
        mainDeck: [],
        extraDeck: [],
        sideDeck: [],
        deckFormat: "Master Duel",
      },
      isDirty: false,
      editGeneration: 0,
      error: null,
    });
    (useUserDecks as jest.Mock).mockReturnValue({
      decks: [labrynth],
      isLoading: false,
      error: null,
      invalidate: jest.fn(),
    });
    (useUserStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: { user: { id: string } | null }) => unknown) =>
        selector({ user: { id: "user-1" } }),
    );
    (useDeck as jest.Mock).mockReturnValue({
      loadDeck: jest.fn(),
      clearDeck: jest.fn(),
    });
  });

  it("renders saved decks and reports real legality instead of sample copy", async () => {
    const user = userEvent.setup();
    render(<ArchivesScreen />);

    expect(screen.getByText("MASTER DECK ALCHEMIST")).toBeInTheDocument();
    expect(screen.getByText("ARCHIVES // DECKLISTS")).toBeInTheDocument();
    expect(screen.getByText("Resume editing a decklist or initiate a new build.")).toBeInTheDocument();
    expect(screen.getAllByText("Labrynth").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MAIN 1 · EXTRA 0 · SIDE 0").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /all decks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new deck/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search decks" })).toBeInTheDocument();
    expect(screen.getByText("YU-GI-OH! IS THE INTELLECTUAL PROPERTY OF KONAMI AND 4K TV.")).toBeInTheDocument();
    expect(screen.queryByText(/purrely/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/kashtira/i)).not.toBeInTheDocument();
    expect(screen.getByText("Strategist readout is not connected for this deck.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /master duel/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /alerts/i }));
    expect(await screen.findByRole("dialog", { name: /alerts/i })).toBeInTheDocument();
    expect(screen.getByText("Labrynth: main deck must be 40–60 (has 1)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /alerts/i })).not.toBeInTheDocument();
    });

    const more = screen.getAllByRole("button", { name: /more options for labrynth/i });
    await user.click(more[0]);
    await user.click(screen.getByRole("menuitem", { name: "DETAILS" }));
    expect(screen.getByRole("dialog", { name: /deck list/i })).toBeInTheDocument();
    expect(screen.getByText("Ash Blossom & Joyous Spring")).toBeInTheDocument();
    expect(screen.getByText("$2.25 USD")).toBeInTheDocument();
  });

  it("renames from the open workshop list instead of the cached row", async () => {
    const user = userEvent.setup();
    const liveCard = { ...card("Live Ash"), id: 99, deckInstanceId: "live-1" };
    useLiveDeckStore.setState({
      currentDeck: { ...labrynth, mainDeck: [liveCard] },
      isDirty: true,
      editGeneration: 4,
      error: null,
    });
    (saveDeck as jest.Mock).mockResolvedValue({});

    render(<ArchivesScreen />);
    await user.click(screen.getAllByRole("button", { name: /more options for labrynth/i })[0]);
    await user.click(screen.getByRole("menuitem", { name: "RENAME" }));
    await user.click(screen.getByRole("button", { name: "SAVE" }));

    await waitFor(() => expect(saveDeck).toHaveBeenCalled());
    expect(saveDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "deck-labrynth",
        name: "Labrynth",
        mainDeck: [expect.objectContaining({ name: "Live Ash" })],
      }),
      "user-1",
      { isNewDeckId: false },
    );
    expect(loadPersistedDeck).not.toHaveBeenCalled();
  });

  it("copies the saved row when workshop has a different deck open", async () => {
    const user = userEvent.setup();
    (loadPersistedDeck as jest.Mock).mockResolvedValue({
      ...labrynth,
      mainDeck: [{ ...card("Server Card"), id: 50, deckInstanceId: "server" }],
    });
    (saveDeck as jest.Mock).mockResolvedValue({});

    render(<ArchivesScreen />);
    await user.click(screen.getAllByRole("button", { name: /more options for labrynth/i })[0]);
    await user.click(screen.getByRole("menuitem", { name: "COPY" }));
    await user.click(screen.getByRole("button", { name: "COPY" }));

    await waitFor(() => expect(saveDeck).toHaveBeenCalled());
    expect(saveDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Labrynth (Copy)",
        isPinned: false,
        mainDeck: [expect.objectContaining({ name: "Server Card" })],
      }),
      "user-1",
      { isNewDeckId: true },
    );
  });
});
