import { useQuery } from "@tanstack/react-query"

import {
  fetchChoroplethCommunes,
  fetchChoroplethDepartements,
  type ChoroplethFeatureCollection,
  type Lod,
  type TypeLocal,
} from "@/lib/dvf"
import type { Mesh } from "@/store/filters"

/**
 * Récupère la FeatureCollection choroplèthe pour la maille / le LOD courants.
 * La clé de cache est déterministe (maille + type + lod) -> react-query déduplique
 * et met en cache automatiquement.
 */
export function useChoropleth(mesh: Mesh, typeLocal: TypeLocal, lod: Lod) {
  return useQuery<ChoroplethFeatureCollection>({
    queryKey: ["choropleth", mesh, typeLocal, lod],
    queryFn: () =>
      mesh === "communes"
        ? fetchChoroplethCommunes(typeLocal, lod)
        : fetchChoroplethDepartements(typeLocal, lod),
  })
}
