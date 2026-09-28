import {
  countSectionEntries,
  sumSnapshotCopies,
} from "@/lib/eval/snapshot-counts";

describe("countSectionEntries / sumSnapshotCopies", () => {
  it("sums expanded DeckType rows to physical copy totals (not unique IDs)", () => {
    // 40 expanded main entries with duplicates → fewer unique IDs
    const main = [
      { id: 1 },
      { id: 1 },
      { id: 1 },
      { id: 2 },
      { id: 2 },
      ...Array.from({ length: 35 }, (_, i) => ({ id: 100 + i })),
    ];
    const snap = countSectionEntries(main);
    expect(sumSnapshotCopies(snap)).toBe(40);
    expect(snap.length).toBe(37); // 2 duplicate ids + 35 uniques
    expect(snap.find((e) => e.id === 1)?.count).toBe(3);
  });

  it("respects pre-aggregated id+count rows without double-counting length", () => {
    const snap = countSectionEntries([
      { id: 10, count: 3 },
      { id: 20, count: 2 },
    ]);
    expect(snap).toEqual([
      { id: 10, count: 3 },
      { id: 20, count: 2 },
    ]);
    expect(sumSnapshotCopies(snap)).toBe(5);
    expect(snap.length).toBe(2);
  });
});
