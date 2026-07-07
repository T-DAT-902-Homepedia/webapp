import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"

import { deptFromCodeCommune, fetchCommunesDept, type Fiche } from "@/lib/commune"
import { useMeta } from "@/hooks/useMeta"

/**
 * Toutes les fiches d'un département (cache PARTAGÉ par département : deux
 * fiches du même département = un seul fetch). Même motif CDN que
 * useChoropleth : clé versionnée par meta.base, staleTime Infinity.
 */
export function useFichesDept(dept: string | undefined) {
  const { data: meta } = useMeta()
  return useQuery({
    queryKey: ["communes", meta?.base, dept],
    queryFn: () => fetchCommunesDept(meta!.base, dept!),
    enabled: !!meta && !!dept,
    staleTime: Infinity,
  })
}

/** Fiche d'une commune. `data === undefined` avec isSuccess = introuvable. */
export function useFiche(codeCommune: string | undefined) {
  const { data: meta } = useMeta()
  const dept = codeCommune ? deptFromCodeCommune(codeCommune) : undefined
  const select = useCallback(
    (fiches: Fiche[]) => fiches.find((f) => f.code_commune === codeCommune),
    [codeCommune],
  )
  return useQuery({
    queryKey: ["communes", meta?.base, dept],
    queryFn: () => fetchCommunesDept(meta!.base, dept!),
    enabled: !!meta && !!dept,
    staleTime: Infinity,
    select,
  })
}
