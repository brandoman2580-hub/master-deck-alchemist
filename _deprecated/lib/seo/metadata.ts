import { Metadata } from "next";

const siteConfig = {
  name: "Master Deck Alchemist",
  description:
    "Build and optimize your Yu-Gi-Oh! decks with AI-powered recommendations and analysis tools.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://masterdeckalchemist.com",
  ogImage: "/images/og-image.png",
  twitterCard: "/images/twitter-card.png",
};

interface GenerateMetadataOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
  keywords?: string[];
}

/**
 * Generate comprehensive metadata for a page
 * Includes title, description, Open Graph, Twitter Cards, and canonical URLs
 */
export function generateMetadata({
  title,
  description,
  path = "",
  image,
  noIndex = false,
  keywords = [
    "yu-gi-oh",
    "yugioh",
    "deck builder",
    "master duel",
    "tcg",
    "deck analysis",
    "yugioh deck",
    "card game",
  ],
}: GenerateMetadataOptions): Metadata {
  const fullTitle = title
    ? `${title} | ${siteConfig.name}`
    : siteConfig.name;

  const fullDescription = description || siteConfig.description;
  const url = `${siteConfig.url}${path}`;
  const ogImage = image
    ? image.startsWith("http")
      ? image
      : `${siteConfig.url}${image}`
    : `${siteConfig.url}${siteConfig.ogImage}`;
  const twitterImage = image
    ? image.startsWith("http")
      ? image
      : `${siteConfig.url}${image}`
    : `${siteConfig.url}${siteConfig.twitterCard}`;

  return {
    title: fullTitle,
    description: fullDescription,
    keywords,
    authors: [{ name: siteConfig.name }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    robots: noIndex ? "noindex, nofollow" : "index, follow",
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      title: fullTitle,
      description: fullDescription,
      siteName: siteConfig.name,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: fullDescription,
      images: [twitterImage],
    },
  };
}
