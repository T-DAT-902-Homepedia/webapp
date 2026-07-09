import { useQueries } from "@tanstack/react-query"

import { fetchIrisDept, type IrisFeature } from "@/lib/iris"
import { MAX_HIGH_DEPTS } from "@/hooks/useCommunesHigh"
import { useMeta } from "@/hooks/useMeta"

/** Seuil de zoom « quartier » : au-dessus du high commune (10), là où les
 *  IRIS deviennent lisibles. */
export const IRIS_ZOOM_THRESHOLD = 11

/** Feature-gate : run publiant la maille quartier (clés meta additives). */
export function useHasIris(): boolean {
  const { data: meta } = useMeta()
  return (meta?.nb_iris ?? 0) > 0
}

/**
 * IRIS des départements demandés, fusionnés. Même mécanique que
 * useCommunesHigh : un fetch par département, caché indéfiniment. Le
 * feature-gate nb_iris est interne : sur un ancien run, zéro requête.
 */
export function useIrisHigh(depts: string[], enabled: boolean) {
  const { data: meta } = useMeta()
  const hasIris = useHasIris()
  const capped =
    enabled && hasIris && depts.length <= MAX_HIGH_DEPTS ? depts : []
  return useQueries({
    queries: capped.map((dept) => ({
      queryKey: ["choropleth", meta?.base, "iris-high", dept],
      queryFn: () => fetchIrisDept(meta!.base, dept),
      enabled: !!meta,
      staleTime: Infinity,
    })),
    combine: (results) => {
      const features: IrisFeature[] = []
      const loadedDepts = new Set<string>()
      results.forEach((r, i) => {
        if (r.data) {
          features.push(...r.data.features)
          loadedDepts.add(capped[i])
        }
      })
      return {
        features,
        loadedDepts,
        isFetching: results.some((r) => r.isFetching),
      }
    },
  })
}
