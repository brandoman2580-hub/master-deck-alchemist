"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { banlistFingerprint } from "@/lib/meta/banlist-fingerprint";
import { loadGateBands, loadMetaLists } from "@/lib/meta/load-gate-bands";
import type { MetaGateBands } from "@/lib/meta/gate-bands";
import type { MetaListRef } from "@/lib/meta/matchup-plan";
import type { EngineFormat } from "@/lib/engine/types";

/**
 * Current stored meta scores and legal lists for the banlist the caller is holding.
 * An empty fingerprint does not query. A failed read sets `error` and leaves
 * `bands` null so the sheet does not treat a network failure as a stale banlist.
 */
export function useMetaListBands(
  format: EngineFormat,
  banlist: Record<string, string | undefined>,
): {
  bands: MetaGateBands | null;
  lists: MetaListRef[];
  loading: boolean;
  error: string | null;
} {
  const fingerprint = useMemo(() => banlistFingerprint(banlist), [banlist]);

  const query = useQuery({
    queryKey: ["meta-list-bands", format, fingerprint],
    queryFn: async () => {
      const [bands, lists] = await Promise.all([
        loadGateBands(format, fingerprint),
        loadMetaLists(format, fingerprint),
      ]);
      return { bands, lists };
    },
    enabled: fingerprint.length > 0,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const queried = fingerprint.length > 0;
  return {
    bands: queried ? (query.data?.bands ?? null) : null,
    lists: queried ? (query.data?.lists ?? []) : [],
    loading: queried && query.isLoading,
    error: queried && query.isError ? "Stored meta scores could not be loaded." : null,
  };
}
