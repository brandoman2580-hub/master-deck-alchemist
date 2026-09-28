/**
 * Workshop soft-CTA redirect hints for Matchups / Combos tabs.
 */
import {
  mergeCoachRedirectHint,
  resolveWorkshopTabRedirect,
} from "@/lib/engine";

describe("resolveWorkshopTabRedirect", () => {
  it("returns workshop_matchups for meta_matchup when Facts have rows", () => {
    expect(
      resolveWorkshopTabRedirect({
        mode: "qa",
        qaFocus: "meta_matchup",
        matchupCount: 2,
        comboLineCount: 0,
      }),
    ).toBe("workshop_matchups");
  });

  it("returns workshop_matchups for side_plan when Facts have rows", () => {
    expect(
      resolveWorkshopTabRedirect({
        mode: "qa",
        qaFocus: "side_plan",
        matchupCount: 1,
        comboLineCount: 3,
      }),
    ).toBe("workshop_matchups");
  });

  it("omits matchup hint when Facts matchups are empty", () => {
    expect(
      resolveWorkshopTabRedirect({
        mode: "qa",
        qaFocus: "meta_matchup",
        matchupCount: 0,
        comboLineCount: 5,
      }),
    ).toBeUndefined();
  });

  it("returns workshop_combos for play_line when combo lines exist", () => {
    expect(
      resolveWorkshopTabRedirect({
        mode: "qa",
        qaFocus: "play_line",
        matchupCount: 2,
        comboLineCount: 1,
      }),
    ).toBe("workshop_combos");
  });

  it("omits combo hint when no curated lines", () => {
    expect(
      resolveWorkshopTabRedirect({
        mode: "qa",
        qaFocus: "play_line",
        matchupCount: 3,
        comboLineCount: 0,
      }),
    ).toBeUndefined();
  });

  it("does not attach workshop hints on tune_copies / discover_synergy", () => {
    expect(
      resolveWorkshopTabRedirect({
        mode: "tune_copies",
        qaFocus: "play_line",
        matchupCount: 2,
        comboLineCount: 2,
      }),
    ).toBeUndefined();
    expect(
      resolveWorkshopTabRedirect({
        mode: "discover_synergy",
        qaFocus: "meta_matchup",
        matchupCount: 2,
        comboLineCount: 2,
      }),
    ).toBeUndefined();
  });
});

describe("mergeCoachRedirectHint", () => {
  it("prefers workshop soft-CTA over empty existing", () => {
    expect(
      mergeCoachRedirectHint({
        existing: undefined,
        workshopHint: "workshop_combos",
      }),
    ).toBe("workshop_combos");
  });

  it("keeps OOB meta_panel when no workshop hint", () => {
    expect(
      mergeCoachRedirectHint({
        existing: "meta_panel",
        workshopHint: undefined,
      }),
    ).toBe("meta_panel");
  });

  it("lets workshop hint win over stray non-OOB existing", () => {
    expect(
      mergeCoachRedirectHint({
        existing: "workshop_matchups",
        workshopHint: "workshop_combos",
      }),
    ).toBe("workshop_combos");
  });

  it("drops groq-invented workshop hint when server omits (empty Facts)", () => {
    expect(
      mergeCoachRedirectHint({
        existing: "workshop_matchups",
        workshopHint: undefined,
      }),
    ).toBeUndefined();
  });
});
