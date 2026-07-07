import { useQuery } from "@tanstack/react-query"

import { fetchScore } from "@/lib/score"
import { useMeta } from "@/hooks/useMeta"

/**
 * Choroplèthe communale adaptée au format score (carte /map + classement) :
 * clé versionnée par meta.base, cache partagé entre les deux pages.
 */
export function useScore() {
  const { data: meta, isError: metaError } = useMeta()
  const query = useQuery({
    queryKey: ["score", meta?.base],
    queryFn: () => fetchScore(meta!.base),
    enabled: !!meta,
    staleTime: Infinity,
  })
  return { ...query, isError: query.isError || metaError }
}
