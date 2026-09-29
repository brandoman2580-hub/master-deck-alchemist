/**
 * Turn a relative share path (`/share/…`) into an absolute URL for copy/QR.
 */
export function toAbsoluteShareUrl(shareUrl: string): string {
  if (/^https?:\/\//i.test(shareUrl)) return shareUrl;
  const path = shareUrl.startsWith("/") ? shareUrl : `/${shareUrl}`;
  if (typeof window !== "undefined") {
    const configured =
      process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_URL || "";
    const base = (configured || window.location.origin).replace(/\/$/, "");
    return `${base}${path}`;
  }
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PUBLIC_URL ||
    ""
  ).replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}
