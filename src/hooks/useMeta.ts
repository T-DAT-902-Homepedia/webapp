import { useQuery } from "@tanstack/react-query"

import { fetchMeta } from "@/lib/data"

/**
 * meta.json du CDN : run courant + stats globales. Toutes les autres queries
 * suivent le motif `enabled: !!meta`, `meta.base` dans la queryKey,
 * `staleTime: Infinity` (artefacts immuables versionnés par chemin).
 */
export function useMeta() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: fetchMeta,
    staleTime: 5 * 60 * 1000, // aligné sur le cache HTTP du bucket
  })
}
