import { useMemo } from "react"
import { useQueries } from "@tanstack/react-query"

import { fetchChoropleth, type ChoroplethFeature } from "@/lib/choropleth"
import { bboxIntersects, deptBboxes, type Bbox } from "@/lib/centroids"
import { useChoropleth } from "@/hooks/useChoropleth"
import { useMeta } from "@/hooks/useMeta"

/** Seuil de zoom à partir duquel les contours fins sont chargés. */
export const HIGH_ZOOM_THRESHOLD = 10
/** Garde-fou : au-delà, rester en mid (dézoom extrême avec high actif). */
export const MAX_HIGH_DEPTS = 15

/**
 * Codes des départements dont l'emprise intersecte le viewport, triés
 * (identité stable pour les queryKeys). Source : la choroplèthe
 * départementale low, déjà en cache après la vue initiale.
 */
export function useVisibleDepartements(viewBounds: Bbox | null): string[] {
  const { data: depts } = useChoropleth("departements", "low")
  const bboxes = useMemo(
    () => (depts ? deptBboxes(depts.features) : new Map<string, Bbox>()),
    [depts],
  )
  return useMemo(() => {
    if (!viewBounds) return []
    const out: string[] = []
    for (const [code, bbox] of bboxes) {
      if (bboxIntersects(bbox, viewBounds)) out.push(code)
    }
    return out.sort()
  }, [bboxes, viewBounds])
}

/**
 * Contours fins (50m) des départements demandés, fusionnés. Un fetch par
 * département, caché indéfiniment (artefacts immuables) — le pan ne
 * re-télécharge jamais un département déjà vu.
 */
export function useCommunesHigh(depts: string[], enabled: boolean) {
  const { data: meta } = useMeta()
  const capped = enabled && depts.length <= MAX_HIGH_DEPTS ? depts : []
  return useQueries({
    queries: capped.map((dept) => ({
      queryKey: ["choropleth", meta?.base, "communes-high", dept],
      queryFn: () => fetchChoropleth(meta!.base, "communes", "high", dept),
      enabled: !!meta,
      staleTime: Infinity,
    })),
    combine: (results) => {
      const features: ChoroplethFeature[] = []
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
