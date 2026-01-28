import Script from "next/script";

interface StructuredDataProps {
  data: object | object[];
}

/**
 * StructuredData component for injecting JSON-LD schema markup
 * Improves SEO by providing structured data to search engines
 */
export function StructuredData({ data }: StructuredDataProps) {
  const jsonLd = Array.isArray(data) ? data : [data];

  return (
    <>
      {jsonLd.map((item, index) => (
        <Script
          key={index}
          id={`structured-data-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
