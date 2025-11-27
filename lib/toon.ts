// Utility to sanitize strings for token-efficiency
function safeStr(v: any) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

/**
 * Convert a uniform array of objects into a compact TOON table string.
 * - name: top-level name (used in header)
 * - fields: ordered keys to include
 * - truncate: per-field truncation limit (optional)
 */
export function toTOON({
  name,
  items,
  fields,
  truncate = {},
}: {
  name: string;
  items: Record<string, any>[];
  fields: string[];
  truncate?: Record<string, number>;
}) {
  const header = `${name} (${items.length}) | fields: ${fields.join(',')}`;
  const tableHeader = fields.join(' | ');

  const rows = items.map((it) =>
    fields
      .map((f) => {
        const raw = it[f];
        let s = safeStr(raw);
        const max = truncate[f];
        if (max && s.length > max) s = s.slice(0, max) + '…';
        // wrap when necessary
        if (s.includes('|') || s.includes('"') || s.includes('\n')) {
          s = `"${s.replace(/"/g, '\\"')}"`;
        }
        return s;
      })
      .join(' | ')
  );

  return [header, '', tableHeader, ...rows, ''].join('\n');
}
