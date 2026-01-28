# SEO Quick Reference
## Master Deck Alchemist - Developer Checklist

### Before Deploying Any Page

- [ ] Page has unique `metadata` export with title and description
- [ ] Open Graph tags are configured
- [ ] Twitter Card tags are configured
- [ ] Canonical URL is set
- [ ] Structured data (JSON-LD) is included if applicable
- [ ] Images have descriptive alt text
- [ ] Semantic HTML structure is correct (h1 → h2 → h3)
- [ ] Page is accessible (keyboard navigation, ARIA labels)

---

## Common Patterns

### Page Metadata

```typescript
import { Metadata } from 'next';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Deck Builder',
  description: 'Build and optimize your Yu-Gi-Oh! decks with AI-powered recommendations.',
  path: '/deck-builder',
});
```

### Dynamic Metadata (for routes with params)

```typescript
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const deck = await getDeckShare(params.token);
  
  return {
    title: `${deck.name} | Shared Deck`,
    description: `View ${deck.name} - ${deck.mainDeck.length} main deck cards.`,
    openGraph: {
      title: deck.name,
      images: [`/api/og/deck?token=${params.token}`],
    },
  };
}
```

### Structured Data

```typescript
import { StructuredData } from '@/components/seo/structured-data';
import { generateOrganizationSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data';

export default function Page() {
  return (
    <>
      <StructuredData data={generateOrganizationSchema()} />
      <StructuredData data={generateBreadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Deck Builder', url: '/deck-builder' },
      ])} />
      {/* Page content */}
    </>
  );
}
```

### Images with SEO

```typescript
import Image from 'next/image';

<Image
  src="/card.jpg"
  alt="Blue-Eyes White Dragon - Yu-Gi-Oh! card"
  width={300}
  height={420}
  priority={isAboveFold} // For hero images
/>
```

---

## SEO Checklist by Page Type

### Static Pages (Home, About, etc.)

- [ ] Unique title and description
- [ ] Open Graph tags
- [ ] Twitter Card tags
- [ ] Canonical URL
- [ ] Organization schema
- [ ] Breadcrumb schema
- [ ] Proper heading hierarchy

### Dynamic Pages (Deck Shares, User Content)

- [ ] Dynamic metadata generation
- [ ] Dynamic Open Graph images
- [ ] Canonical URL with proper params handling
- [ ] Appropriate structured data (e.g., Deck schema)
- [ ] Fallback metadata for error states

### List Pages (Saved Decks, Search Results)

- [ ] Pagination metadata
- [ ] Canonical URL handling for pagination
- [ ] Noindex for empty states (optional)
- [ ] Proper pagination structured data

---

## Quick Wins

### 1. Add Metadata to All Pages (30 min per page)

```typescript
// app/deck-builder/page.tsx
export const metadata: Metadata = {
  title: 'Deck Builder | Master Deck Alchemist',
  description: 'Build and optimize your Yu-Gi-Oh! decks',
};
```

### 2. Create robots.txt (5 min)

```txt
# public/robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /private/

Sitemap: https://masterdeckalchemist.com/sitemap.xml
```

### 3. Create Sitemap (15 min)

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://masterdeckalchemist.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    // ... more routes
  ]
}
```

### 4. Add Open Graph Tags (10 min)

```typescript
export const metadata: Metadata = {
  openGraph: {
    title: 'Master Deck Alchemist',
    description: 'Build and optimize your Yu-Gi-Oh! decks',
    images: ['/images/og-image.png'],
  },
};
```

---

## Testing Checklist

Before deploying SEO changes:

- [ ] Test metadata with [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Validate structured data with [Schema Validator](https://validator.schema.org/)
- [ ] Check Open Graph with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [ ] Test Twitter Card with [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [ ] Verify robots.txt is accessible at `/robots.txt`
- [ ] Verify sitemap.xml is accessible at `/sitemap.xml`
- [ ] Check canonical URLs are correct
- [ ] Run Lighthouse SEO audit (target: 90+)

---

## Common Issues & Solutions

### Issue: Duplicate Content
**Solution**: Ensure canonical URLs are set correctly, especially for pages with query parameters.

### Issue: Missing Meta Tags
**Solution**: Use the `generateMetadata` utility function consistently across all pages.

### Issue: Images Not Indexed
**Solution**: Ensure all images have descriptive alt text and consider using ImageObject schema.

### Issue: Slow Indexing
**Solution**: Submit sitemap to Google Search Console, ensure robots.txt allows crawling.

### Issue: Poor Social Sharing Preview
**Solution**: Add Open Graph images (1200x630px recommended), ensure OG tags are complete.

---

## Resources

- [Full SEO Plan](./seo-improvement-plan.md)
- [Next.js Metadata Docs](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Schema.org Types](https://schema.org/docs/full.html)
- [Google Search Central](https://developers.google.com/search)

---

**Last Updated**: January 27, 2026
