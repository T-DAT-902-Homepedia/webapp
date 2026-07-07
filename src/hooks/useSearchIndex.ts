import { useQuery } from "@tanstack/react-query"

import { buildSearchIndex, fetchSearchIndex } from "@/lib/search"
import { useMeta } from "@/hooks/useMeta"

/**
 * Index de recherche préparé (normalisation pré-calculée). Lazy : fetché à la
 * première ouverture de la palette (`enabled`), puis en cache pour la session.
 */
export function useSearchIndex(enabled: boolean) {
  const { data: meta } = useMeta()
  return useQuery({
    queryKey: ["search-index", meta?.base],
    queryFn: async () => buildSearchIndex(await fetchSearchIndex(meta!.base)),
    enabled: enabled && !!meta,
    staleTime: Infinity,
  })
}
