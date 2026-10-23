/**
 * @jest-environment jsdom
 */
import { Fragment } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { MdaCardPreview } from "@/components/mda/mda-card-preview";
import type { Card } from "@/types/card";

expect.extend(toHaveNoViolations);

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: 1,
    deckInstanceId: "soul-resonator",
    name: "Soul Resonator",
    type: "Tuner Monster",
    desc: "If this card is summoned, add 1 FIRE monster from your GY.",
    atk: 500,
    def: 200,
    level: 3,
    race: "Fiend",
    attribute: "FIRE",
    archetype: "Resonator",
    misc_info: [{ md_rarity: "N" }],
    card_sets: {
      set_name: "",
      set_code: "",
      set_rarity: "",
      set_rarity_code: "",
      set_price: "",
    },
    card_images: [],
    card_prices: [],
    ...overrides,
  };
}

async function openPreview(name: string): Promise<HTMLElement> {
  const user = userEvent.setup();
  await user.hover(screen.getByRole("button", { name }));
  const headings = await screen.findAllByRole("heading", { name, hidden: true });
  const heading = headings.find((node) => !node.closest("[role='tooltip']"));
  if (!heading) throw new Error(`Visible preview heading missing for ${name}`);
  const surface = heading.closest("[data-mda-glass-surface]");
  if (!(surface instanceof HTMLElement)) throw new Error("Glass surface missing");
  return surface;
}

describe("MdaCardPreview", () => {
  it("shows Space Grotesk, category tags, and labeled stats", async () => {
    const { baseElement } = render(
      <MdaCardPreview card={card()}>
        <button type="button">Soul Resonator</button>
      </MdaCardPreview>,
    );

    const surface = await openPreview("Soul Resonator");
    expect(surface.closest(".mda-preview-content")).toBeTruthy();
    expect(surface.className).toMatch(/border-\[#5b6369\]/);
    expect(baseElement.querySelector(".mda-l-arm")).not.toBeInTheDocument();
    expect(surface.querySelector(".font-spaceGrotesk")).toBeTruthy();
    expect(surface.querySelector(".font-mda")).not.toBeInTheDocument();

    const categories = surface.querySelector("[aria-label='Card categories']");
    expect(categories).toHaveTextContent("Tuner Monster");
    expect(categories).toHaveTextContent("FIRE");
    expect(categories).toHaveTextContent("Fiend");
    expect(categories).toHaveTextContent("Resonator");
    expect(categories?.querySelector("li")).toHaveClass("border", "bg-white", "text-[#0c0e12]");

    const levelTerm = surface.querySelector("dt");
    expect(levelTerm?.parentElement?.tagName).toBe("DL");
    expect(levelTerm?.parentElement).toHaveTextContent("Level");
    expect(surface.className).not.toMatch(/backdrop-blur/);
    expect(surface.textContent).toContain("ATK");
    expect(surface.textContent).toContain("500");
    expect(surface.textContent).toContain("DEF");
    expect(surface.textContent).toContain("200");
    expect(surface.querySelector("p")).toHaveClass("text-[#0c0e12]");

    expect(await axe(surface)).toHaveNoViolations();
  });

  it("omits combat stats on a spell", async () => {
    render(
      <MdaCardPreview
        card={card({
          name: "Resonator Call",
          type: "Spell Card",
          attribute: undefined,
          race: "Normal",
          archetype: "Resonator",
          level: undefined,
          atk: undefined,
          def: undefined,
          desc: "Add 1 Resonator monster from your Deck.",
        })}
      >
        <button type="button">Resonator Call</button>
      </MdaCardPreview>,
    );

    const surface = await openPreview("Resonator Call");
    expect(surface.querySelector("[aria-label='Card categories']")).toHaveTextContent("Spell Card");
    expect(surface.textContent).not.toContain("ATK");
    expect(surface.textContent).not.toContain("Level");
  });

  it("describes the focused control once", async () => {
    const user = userEvent.setup();
    render(
      <MdaCardPreview card={card()}>
        <button type="button">Soul Resonator</button>
      </MdaCardPreview>,
    );

    await user.tab();
    const button = screen.getByRole("button", { name: "Soul Resonator" });
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const tooltip = document.getElementById(describedBy ?? "");
    expect(tooltip).toHaveAttribute("role", "tooltip");
    expect(tooltip).toHaveTextContent("Soul Resonator");
    expect(tooltip).toHaveTextContent("Level 3");
    expect(tooltip).toHaveTextContent("add 1 FIRE monster");
    expect(screen.queryByRole("heading", { name: "Soul Resonator" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Soul Resonator", hidden: true })).toHaveLength(1);
  });

  it("does not warn about keys when a card has several children", async () => {
    const user = userEvent.setup();
    const errors: unknown[][] = [];
    const spy = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });

    render(
      <MdaCardPreview card={card()}>
        <button type="button">
          <span>Art</span>
          <span>Click to add card to deck</span>
          Soul Resonator
        </button>
      </MdaCardPreview>,
    );

    await user.tab();
    spy.mockRestore();
    const keyWarning = errors.some((args) =>
      args.some((arg) => String(arg).includes('unique "key" prop')),
    );
    expect(keyWarning).toBe(false);
    expect(document.activeElement).toHaveAttribute(
      "aria-describedby",
      expect.stringMatching(/\S/),
    );
  });

  it("keeps a description the control already had", async () => {
    const user = userEvent.setup();
    render(
      <Fragment>
        <MdaCardPreview card={card()}>
          <button type="button" aria-describedby="limit-note">
            Soul Resonator
          </button>
        </MdaCardPreview>
        <button type="button">Next</button>
        <span id="limit-note">Limited to 3</span>
      </Fragment>,
    );

    await user.tab();
    const button = screen.getByRole("button", { name: "Soul Resonator" });
    expect(document.activeElement).toBe(button);
    const describedBy = button.getAttribute("aria-describedby") ?? "";
    expect(describedBy.startsWith("limit-note ")).toBe(true);
    const tooltipId = describedBy.split(/\s+/).find((id) => id !== "limit-note") ?? "";
    expect(document.getElementById(tooltipId)).toHaveAttribute("role", "tooltip");
    expect(document.getElementById("limit-note")).toHaveTextContent("Limited to 3");

    await user.tab();
    expect(screen.getByRole("button", { name: "Soul Resonator" })).toHaveAttribute(
      "aria-describedby",
      "limit-note",
    );
  });
});
