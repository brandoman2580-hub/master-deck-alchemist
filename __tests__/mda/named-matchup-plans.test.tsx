import { fireEvent, render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { NamedMatchupPlans } from "@/components/mda/named-matchup-plans";

expect.extend(toHaveNoViolations);

const lists = [
  {
    name: "Elfnote",
    tier: 1 as const,
    cards: [{ name: "Elfnote Lucina", copies: 3, zone: "main" as const }],
  },
  {
    name: "Branded",
    tier: 3 as const,
    cards: [
      { name: "Branded Fusion", copies: 1, zone: "main" as const },
      { name: "Mirrorjade the Iceblade Dragon", copies: 1, zone: "extra" as const },
    ],
  },
];

describe("NamedMatchupPlans", () => {
  it("filters a tier and has no axe violations", async () => {
    const { container } = render(<NamedMatchupPlans lists={lists} userCards={[]} />);
    expect(
      screen.getByRole("heading", { name: "Against these decks", level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Branded", level: 4 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Show Tier 3" }));
    expect(screen.queryByRole("heading", { name: "Branded" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Elfnote", level: 4 })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
