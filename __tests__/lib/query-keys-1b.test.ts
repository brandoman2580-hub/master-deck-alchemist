import { workshopFactsQueryKey } from "@/hooks/useWorkshopFacts";
import { cardLibraryQueryKey } from "@/lib/query/card-library";

describe("Phase 1b query keys", () => {
  it("keeps card-library key stable", () => {
    expect(cardLibraryQueryKey()).toEqual(["card-library"]);
  });

  it("includes deckHash and format in Facts key", () => {
    const key = workshopFactsQueryKey("abc123", "Master Duel", "10");
    expect(key).toEqual(["workshop-facts", "abc123", "Master Duel", "10"]);
  });
});
