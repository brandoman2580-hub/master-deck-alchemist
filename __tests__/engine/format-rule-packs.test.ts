import {
  applyFormatRulePack,
  maxxOutResilienceDelta,
  MAXX_C_CARD_NAME,
} from "@/lib/engine/format-rule-packs";
import type { RoleCoverage } from "@/lib/engine/types";

const emptyRoles = (overrides: Partial<RoleCoverage> = {}): RoleCoverage => ({
  starters: 0,
  extenders: 0,
  handTraps: 0,
  boardBreakers: 0,
  endboardPieces: 0,
  locks: 0,
  ...overrides,
});

describe("format rule packs", () => {
  describe("maxxOutResilienceDelta", () => {
    it("penalizes zero outs harder than it rewards a full package", () => {
      expect(maxxOutResilienceDelta(0)).toBe(-12);
      expect(maxxOutResilienceDelta(6)).toBe(8);
      expect(Math.abs(maxxOutResilienceDelta(0))).toBeGreaterThan(
        maxxOutResilienceDelta(6),
      );
    });
  });

  describe("TCG tournament pack", () => {
    it("never activates Maxx pressure and uses TCG banlist framing", () => {
      const result = applyFormatRulePack({
        format: "TCG",
        banlist: { [MAXX_C_CARD_NAME]: "Forbidden" },
        mainDeckCardNames: [],
        roleCoverage: emptyRoles({ handTraps: 9, boardBreakers: 2 }),
      });
      expect(result.packId).toBe("tcgTournament");
      expect(result.maxxPressureActive).toBe(false);
      expect(result.maxxOutCount).toBe(0);
      expect(result.resilienceDelta).toBe(4);
      expect(result.notes.some((n) => /TCG tournament banlist/i.test(n))).toBe(
        true,
      );
      expect(result.notes.some((n) => /Master Duel list is not used/i.test(n))).toBe(
        true,
      );
    });

    it("penalizes near-zero interaction density", () => {
      const result = applyFormatRulePack({
        format: "TCG",
        mainDeckCardNames: [],
        roleCoverage: emptyRoles({ handTraps: 0, boardBreakers: 0 }),
      });
      expect(result.resilienceDelta).toBe(-6);
      expect(result.disruptionDelta).toBe(-4);
    });
  });

  describe("Master Duel Maxx C pack", () => {
    it("applies out-density Resilience delta when Maxx is legal on MD list", () => {
      const result = applyFormatRulePack({
        format: "MASTER_DUEL",
        banlist: { [MAXX_C_CARD_NAME]: "Unlimited" },
        mainDeckCardNames: [
          'Ash Blossom & Joyous Spring',
          'Ash Blossom & Joyous Spring',
          'Ash Blossom & Joyous Spring',
          "Called by the Grave",
          "Called by the Grave",
          "Crossout Designator",
        ],
        roleCoverage: emptyRoles(),
      });
      expect(result.packId).toBe("masterDuelMaxxC");
      expect(result.maxxPressureActive).toBe(true);
      expect(result.maxxOutCount).toBe(6);
      expect(result.resilienceDelta).toBe(8);
      expect(result.notes.some((n) => /Master Duel banlist applies/i.test(n))).toBe(
        true,
      );
    });

    it("is inert when Maxx is Forbidden on the MD list", () => {
      const result = applyFormatRulePack({
        format: "MASTER_DUEL",
        banlist: { [MAXX_C_CARD_NAME]: "Forbidden" },
        mainDeckCardNames: [],
        roleCoverage: emptyRoles(),
      });
      expect(result.maxxPressureActive).toBe(false);
      expect(result.resilienceDelta).toBe(0);
      expect(result.notes.some((n) => /inert/i.test(n))).toBe(true);
    });

    it("does not treat Imperm as a Maxx hard out", () => {
      const result = applyFormatRulePack({
        format: "MASTER_DUEL",
        banlist: { [MAXX_C_CARD_NAME]: "Limited" },
        mainDeckCardNames: [
          "Infinite Impermanence",
          "Infinite Impermanence",
          "Infinite Impermanence",
        ],
        roleCoverage: emptyRoles({ handTraps: 3 }),
      });
      expect(result.maxxOutCount).toBe(0);
      expect(result.resilienceDelta).toBe(-12);
    });
  });
});
