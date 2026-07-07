import { useQuery } from "@tanstack/react-query"

import { fetchPointsSample } from "@/lib/points"
import { useMeta } from "@/hooks/useMeta"

/** Échantillon de mutations pour la heatmap — lazy (mode heat uniquement). */
export function usePoints(enabled: boolean) {
  const { data: meta } = useMeta()
  return useQuery({
    queryKey: ["points-sample", meta?.base],
    queryFn: () => fetchPointsSample(meta!.base),
    enabled: enabled && !!meta,
    staleTime: Infinity,
  })
}
