import { useQuery } from "@tanstack/react-query"

import { fetchChoropleth, type Lod, type Mesh } from "@/lib/choropleth"
import { useMeta } from "@/hooks/useMeta"

/**
 * FeatureCollection choroplèthe pour la maille / le LOD courants, depuis le CDN.
 * Le type de local ne fait pas partie de la clé : le GeoJSON contient les trois
 * familles de colonnes, changer de type ne refetch rien.
 *
 * Le clamp du LOD vit ici (pas dans lodForZoom) pour que la clé de cache ne
 * produise pas de doublons mid/high identiques.
 */
export function useChoropleth(mesh: Mesh, lod: Lod) {
  const { data: meta } = useMeta()
  const effectiveLod: Lod =
    mesh === "regions"
      ? "low" // régions : un seul LOD (contours 1000m)
      : mesh === "communes"
        ? lod === "high"
          ? "mid" // clamp PR1 : le chargement high par département arrive en PR3
          : lod
        : lod === "low"
          ? "low"
          : "mid" // départements : low|mid seulement
  return useQuery({
    queryKey: ["choropleth", meta?.base, mesh, effectiveLod],
    queryFn: () => fetchChoropleth(meta!.base, mesh, effectiveLod),
    enabled: !!meta,
    staleTime: Infinity,
  })
}
