import { useQuery } from "@tanstack/react-query"

import { fetchPrixSeries } from "@/lib/charts"
import { useMeta } from "@/hooks/useMeta"

/** Séries annuelles de prix au m² par commune, depuis le CDN (artefact immuable
 *  du run courant — même motif que useChoropleth). */
export function usePrixSeries() {
  const { data: meta } = useMeta()
  return useQuery({
    queryKey: ["prix-series", meta?.base],
    queryFn: () => fetchPrixSeries(meta!.base),
    enabled: !!meta,
    staleTime: Infinity,
  })
}
