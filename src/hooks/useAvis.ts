import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"

import { fetchAvisDept, type AvisCommune } from "@/lib/avis"
import { deptFromCodeCommune } from "@/lib/commune"
import { useMeta } from "@/hooks/useMeta"

/**
 * Analyse d'avis d'une commune. Chargée à la demande (la section Avis est le
 * seul consommateur), cache partagé par département. Gate sur
 * meta.nb_communes_avis : les runs sans chaîne NLP n'émettent aucune requête.
 * `data === undefined` = commune non couverte (ou run sans avis).
 */
export function useAvis(codeCommune: string | undefined) {
  const { data: meta } = useMeta()
  const dept = codeCommune ? deptFromCodeCommune(codeCommune) : undefined
  const hasAvis = (meta?.nb_communes_avis ?? 0) > 0
  const select = useCallback(
    (rows: AvisCommune[]) => rows.find((r) => r.code_commune === codeCommune),
    [codeCommune],
  )
  return useQuery({
    queryKey: ["avis", meta?.base, dept],
    queryFn: () => fetchAvisDept(meta!.base, dept!),
    enabled: !!meta && !!dept && hasAvis,
    staleTime: Infinity,
    select,
  })
}
