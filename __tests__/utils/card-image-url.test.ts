/**
 * Unit tests for card image URL resolution (AWS S3 / YGOPRODeck fallback)
 */

import {
  buildCardImageUrl,
  isYgoprodeckImageUrl,
  normalizeCardImages,
  resolveCardImageUrl,
} from "@/lib/card-image-url";

const AWS_BASE =
  "https://mda-card-images-prod.s3.us-east-1.amazonaws.com/cards_small";

describe("card-image-url", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("isYgoprodeckImageUrl", () => {
    it("detects YGOPRODeck CDN URLs", () => {
      expect(
        isYgoprodeckImageUrl(
          "https://images.ygoprodeck.com/images/cards_small/123.jpg",
        ),
      ).toBe(true);
    });

    it("returns false for AWS S3 URLs", () => {
      expect(isYgoprodeckImageUrl(`${AWS_BASE}/123.jpg`)).toBe(false);
    });
  });

  describe("buildCardImageUrl", () => {
    it("uses NEXT_PUBLIC_CARD_IMAGE_BASE_URL when set", () => {
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;
      expect(buildCardImageUrl(42)).toBe(`${AWS_BASE}/42.jpg`);
    });

    it("falls back to YGOPRODeck when external fallback is allowed", () => {
      delete process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL;
      delete process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_CARD_IMAGE_FALLBACK;
      expect(buildCardImageUrl(42, "small")).toBe(
        "https://images.ygoprodeck.com/images/cards_small/42.jpg",
      );
    });

    it("returns placeholder when external fallback is disabled and no base URL", () => {
      process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_CARD_IMAGE_FALLBACK = "true";
      delete process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL;
      expect(buildCardImageUrl(42)).toBe("/placeholder.svg");
    });
  });

  describe("resolveCardImageUrl", () => {
    it("prefers self-hosted URLs from card_images", () => {
      const url = resolveCardImageUrl(1, [
        {
          image_url_small: `${AWS_BASE}/1.jpg`,
          image_url: `${AWS_BASE}/1.jpg`,
        },
      ]);
      expect(url).toBe(`${AWS_BASE}/1.jpg`);
    });

    it("skips YGOPRODeck URLs when external fallback is disabled", () => {
      process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_CARD_IMAGE_FALLBACK = "true";
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;

      const url = resolveCardImageUrl(99, [
        {
          image_url_small:
            "https://images.ygoprodeck.com/images/cards_small/99.jpg",
        },
      ]);

      expect(url).toBe(`${AWS_BASE}/99.jpg`);
    });
  });

  describe("normalizeCardImages", () => {
    it("replaces YGOPRODeck URLs when external fallback is disabled", () => {
      process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_CARD_IMAGE_FALLBACK = "true";
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;

      const result = normalizeCardImages(7, [
        {
          id: 7,
          image_url: "https://images.ygoprodeck.com/images/cards/7.jpg",
          image_url_small:
            "https://images.ygoprodeck.com/images/cards_small/7.jpg",
        },
      ]);

      expect(result[0].image_url_small).toBe(`${AWS_BASE}/7.jpg`);
      expect(result[0].image_url).toBe(`${AWS_BASE}/7.jpg`);
    });

    it("keeps AWS URLs from the database", () => {
      process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_CARD_IMAGE_FALLBACK = "true";
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;

      const awsImages = [
        {
          id: 5,
          image_url: `${AWS_BASE}/5.jpg`,
          image_url_small: `${AWS_BASE}/5.jpg`,
        },
      ];

      expect(normalizeCardImages(5, awsImages)).toEqual(awsImages);
    });
  });
});
