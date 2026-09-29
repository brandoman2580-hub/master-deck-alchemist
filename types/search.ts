/**
 * Workshop / UI filter query shape.
 * Distinct from `CardSearchParams` in `types/card.ts` (API catalog query).
 */
export type SearchParams = {
  type?: string;
  attribute?: string;
  level?: string;
  atk?: string;
  def?: string;
  archetype?: string;
  race?: string;
  rarity?: string;
  effect?: string;
  atkRange?: string;
  defRange?: string;
  banStatus?: string;
};

export type FilterConfig = {
  label: string;
  key: string;
  options: { value: string; label: string }[];
};
