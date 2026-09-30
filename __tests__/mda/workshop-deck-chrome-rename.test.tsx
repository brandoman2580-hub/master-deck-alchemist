import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkshopDeckChrome } from "@/components/mda/workshop-deck-chrome";

jest.mock("@/components/ui/card-image", () => ({
  CardImage: () => <div data-testid="cover" />,
}));

describe("WorkshopDeckChrome rename", () => {
  it("commits a renamed title via onRename", async () => {
    const user = userEvent.setup();
    const onRename = jest.fn();

    render(
      <WorkshopDeckChrome
        deckName="New Deck"
        deckFormat="Master Duel"
        mainCount={0}
        extraCount={0}
        sideCount={0}
        activeTab="build"
        onTabChange={jest.fn()}
        onBackToArchives={jest.fn()}
        onRename={onRename}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Rename deck New Deck" }),
    );
    const input = screen.getByRole("textbox", { name: "Deck name" });
    await user.clear(input);
    await user.type(input, "Branded Despia{Enter}");

    expect(onRename).toHaveBeenCalledWith("Branded Despia");
  });
});
