import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("lists Workshop and Archives without Deck Tester", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/workshop"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/deck-archives"))).toBe(true);
    expect(urls.some((url) => url.includes("/deck-tester"))).toBe(false);
  });
});
