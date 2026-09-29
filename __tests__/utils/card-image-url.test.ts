/**
 * Unit tests for card image URL resolution (AWS S3 / YGOPRODeck fallback)
 */

import fs from "node:fs";
import path from "node:path";
import {
  buildCardImageUrl,
  CARD_IMAGE_PLACEHOLDER,
  isProvisionalCardId,
  isSupabaseStorageImageUrl,
  isYgoprodeckImageUrl,
  normalizeCardImages,
  resolveCardImageUrl,
} from "@/lib/card/image-url";

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

  describe("CARD_IMAGE_PLACEHOLDER asset", () => {
    it("points at a real public SVG so next/image and static GETs do not 404", () => {
      expect(CARD_IMAGE_PLACEHOLDER).toBe("/placeholder.svg");
      const assetPath = path.join(
        process.cwd(),
        "public",
        "placeholder.svg",
      );
      expect(fs.existsSync(assetPath)).toBe(true);
      const svg = fs.readFileSync(assetPath, "utf8");
      expect(svg).toContain("<svg");
      expect(svg.toLowerCase()).toContain("card art unavailable");
    });
  });

  describe("isProvisionalCardId", () => {
    it("flags YGOPRODeck temporary 9-digit IDs", () => {
      expect(isProvisionalCardId(101302023)).toBe(true);
      expect(isProvisionalCardId(100000000)).toBe(true);
    });

    it("allows official Konami passcodes", () => {
      expect(isProvisionalCardId(84477320)).toBe(false);
      expect(isProvisionalCardId(89631139)).toBe(false);
      expect(isProvisionalCardId(8805661)).toBe(false);
    });

    it("does not treat skill-card ID ranges as provisional spoilers", () => {
      expect(isProvisionalCardId(300101001)).toBe(false);
      expect(isProvisionalCardId(501000000)).toBe(false);
    });
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

  describe("isSupabaseStorageImageUrl", () => {
    it("detects legacy Supabase Storage card URLs", () => {
      expect(
        isSupabaseStorageImageUrl(
          "https://izshwywgfaozmisedwxm.supabase.co/storage/v1/object/public/card-images/cards_small/483.jpg",
        ),
      ).toBe(true);
    });

    it("returns false for AWS S3 URLs", () => {
      expect(isSupabaseStorageImageUrl(`${AWS_BASE}/483.jpg`)).toBe(false);
    });
  });

  describe("buildCardImageUrl", () => {
    it("uses NEXT_PUBLIC_CARD_IMAGE_BASE_URL when set", () => {
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;
      expect(buildCardImageUrl(42)).toBe(`${AWS_BASE}/42.jpg`);
    });

    it("returns placeholder for provisional IDs even when S3 base is set", () => {
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;
      expect(buildCardImageUrl(101302023)).toBe(CARD_IMAGE_PLACEHOLDER);
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

    it("never resolves to Supabase Storage when AWS base URL is configured", () => {
      process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_CARD_IMAGE_FALLBACK = "true";
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;

      const url = resolveCardImageUrl(483, [
        {
          image_url_small:
            "https://izshwywgfaozmisedwxm.supabase.co/storage/v1/object/public/card-images/cards_small/483.jpg",
          image_url:
            "https://izshwywgfaozmisedwxm.supabase.co/storage/v1/object/public/card-images/cards/483.jpg",
        },
      ]);

      expect(url).toBe(`${AWS_BASE}/483.jpg`);
      expect(url).not.toContain("supabase.co/storage");
    });

    it("returns placeholder for provisional IDs with null card_images", () => {
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;
      process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_CARD_IMAGE_FALLBACK = "true";

      expect(resolveCardImageUrl(101302023, null)).toBe(CARD_IMAGE_PLACEHOLDER);
      expect(resolveCardImageUrl(101302023, [])).toBe(CARD_IMAGE_PLACEHOLDER);
    });

    it("returns placeholder when official id has no card_images metadata", () => {
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;
      // Missing art metadata must not invent an S3 key that 403s.
      expect(resolveCardImageUrl(8805661, null)).toBe(CARD_IMAGE_PLACEHOLDER);
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

    it("does not invent S3 URLs when card_images is null", () => {
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;
      const result = normalizeCardImages(84477320, null);
      expect(result[0].image_url).toBe(CARD_IMAGE_PLACEHOLDER);
      expect(result[0].image_url_small).toBe(CARD_IMAGE_PLACEHOLDER);
    });

    it("normalizes provisional cards to placeholders", () => {
      process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL = AWS_BASE;
      const result = normalizeCardImages(101302023, null);
      expect(result[0].image_url_small).toBe(CARD_IMAGE_PLACEHOLDER);
    });
  });
});
