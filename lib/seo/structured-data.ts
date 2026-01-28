/**
 * Structured Data (JSON-LD) generators for SEO
 * Implements Schema.org schemas for better search engine understanding
 */

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://masterdeckalchemist.com";

/**
 * Generate Organization schema
 * Identifies the organization behind the website
 */
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Master Deck Alchemist",
    url: siteUrl,
    logo: `${siteUrl}/images/MDA_Logo_One.svg`,
    description:
      "AI-powered Yu-Gi-Oh! deck building and analysis platform",
    sameAs: [
      // Add social media links when available
      // "https://twitter.com/masterdeckalchemist",
      // "https://github.com/masterdeckalchemist",
    ],
  };
}

/**
 * Generate WebApplication schema
 * Describes the web application and its features
 */
export function generateWebApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Master Deck Alchemist",
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Build and optimize your Yu-Gi-Oh! decks with AI-powered recommendations, deck analysis, and testing tools.",
    featureList: [
      "AI-powered deck recommendations",
      "Deck analysis and optimization",
      "Deck testing and simulation",
      "Card search and browser",
      "Deck sharing",
    ],
  };
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Generate BreadcrumbList schema
 * Helps search engines understand page hierarchy
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}`,
    })),
  };
}

/**
 * Generate SoftwareApplication schema for specific features
 */
export function generateSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Master Deck Alchemist",
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      // Add when ratings are available
    },
  };
}
