/**
 * TOON format utility for compact tabular representation
 * Reduces token usage by ~70% compared to JSON
 */

// Utility to sanitize strings for token-efficiency
function safeStr(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/**
 * Convert a uniform array of objects into a compact TOON table string.
 * 
 * @param name - Top-level name (used in header)
 * @param items - Array of objects to convert
 * @param fields - Ordered keys to include
 * @param truncate - Per-field truncation limit (optional)
 * @returns TOON format string
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
}): string {
  const header = `${name} (${items.length}) | fields: ${fields.join(",")}`;
  const tableHeader = fields.join(" | ");

  const rows = items.map((it) =>
    fields
      .map((f) => {
        const raw = it[f];
        let s = safeStr(raw);
        const max = truncate[f];
        if (max && s.length > max) s = s.slice(0, max) + "…";
        // wrap when necessary
        if (s.includes("|") || s.includes('"') || s.includes("\n")) {
          s = `"${s.replace(/"/g, '\\"')}"`;
        }
        return s;
      })
      .join(" | ")
  );

  return [header, "", tableHeader, ...rows, ""].join("\n");
}


