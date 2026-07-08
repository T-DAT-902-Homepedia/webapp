import { useMemo } from "react"

import { useChoropleth } from "@/hooks/useChoropleth"
import type { ChoroplethProperties } from "@/lib/choropleth"
import { meshForZoom } from "@/store/filters"
import { DIMENSIONS, type ScoreCollection, type ScoreFeature } from "@/lib/score"

// Maille adaptative de la carte Qualité de vie : régions au zoom national,
// départements en zoom intermédiaire, communes ensuite — au lieu de 34 928
// polygones dès le zoom 5 (3,4 Mo, illisible). Le pipeline publie les médianes
// du score, du gap ET des 12 dimensions à chaque maille sous les mêmes noms
// n_* : l'adaptation se réduit à un renommage score_median/gap_pondere_median.

export type ScoreMesh = ReturnType<typeof meshForZoom>

export function adaptScoreProperties(p: ChoroplethProperties): ScoreFeature["properties"] {
  const communal = p.code_commune != null
  return {
    code_commune: p.code_commune ?? "",
    nom: p.nom,
    dep: p.code_departement ?? null,
    prix: p.prix_m2_median ?? null,
    prix_maison: p.maison_prix_m2_median ?? null,
    prix_appart: p.appart_prix_m2_median ?? null,
    nb_transactions: p.nb_transactions ?? null,
    dpe: p.dpe_dominant ?? null,
    score_valeur: communal ? (p.score_valeur ?? null) : (p.score_median ?? null),
    gap: p.gap ?? null,
    gap_pondere: communal ? (p.gap_pondere ?? null) : (p.gap_pondere_median ?? null),
    ...(Object.fromEntries(
      DIMENSIONS.map((d) => [d, p[d] ?? null]),
    ) as Record<(typeof DIMENSIONS)[number], number | null>),
  }
}

/** FeatureCollection au format score pour la maille correspondant au zoom. */
export function useScoreMesh(zoom: number): {
  data: ScoreCollection | undefined
  mesh: ScoreMesh
  isLoading: boolean
  isError: boolean
} {
  const mesh = meshForZoom(zoom)
  // LOD grossier en dézoom ; les communes restent en mid (pas de high sur
  // cette carte, l'analyse fine passe par la fiche).
  const { data, isLoading, isError } = useChoropleth(mesh, zoom < 7 ? "low" : "mid")

  const adapted = useMemo<ScoreCollection | undefined>(() => {
    if (!data) return undefined
    return {
      type: "FeatureCollection",
      features: data.features.map((f) => ({
        type: "Feature" as const,
        geometry: f.geometry,
        properties: adaptScoreProperties(f.properties),
      })),
    }
  }, [data])

  return { data: adapted, mesh, isLoading, isError }
}
