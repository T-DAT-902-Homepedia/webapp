import { z } from "zod"

import { artifactUrl } from "@/lib/data"
import { normalizeGeometry } from "@/lib/choropleth"
import type { Metric } from "@/lib/score"

// Maille quartier (IRIS INSEE), publiée depuis ADR-0015 côté pipeline. Couche
// indépendante de la cascade régions/départements/communes : elle ne couvre
// que les communes multi-IRIS (~1 944 villes) et se superpose à la maille
// commune — ailleurs, la commune reste la lecture correcte.

// --- Schéma zod -----------------------------------------------------------------

// `fiable = false` -> valeurs à null -> rendu « pas de donnée », même
// convention que les communes. Les IRIS portent les codes arrondissements à
// Paris/Lyon/Marseille (751xx, 6938x, 132xx) : les fiches communes existent.
export const irisPropertiesSchema = z.object({
  code_iris: z.string(),
  nom: z.string(), // nom du quartier, ex. « Croix-Rousse »
  code_commune: z.string(),
  nom_commune: z.string(),
  type_iris: z.string(),
  code_departement: z.string(),
  // Prix : médiane poolée sur plusieurs millésimes (annee_min–annee_max), à ne
  // jamais comparer chiffre à chiffre au prix communal (millésime courant).
  prix_m2_median: z.number().nullable(),
  nb_transactions: z.number().nullable(),
  fiable: z.boolean(),
  annee_min: z.number().nullable(),
  annee_max: z.number().nullable(),
  // Score hérité de la commune : seuls le prix et le gap varient entre
  // quartiers d'une même ville. gap_iris > 0 = quartier sous-coté.
  score_commune: z.number().nullable(),
  n_prix_iris: z.number().nullable(),
  gap_iris: z.number().nullable(),
  gap_pondere_iris: z.number().nullable(),
})
export type IrisProperties = z.infer<typeof irisPropertiesSchema>

const irisFeature = z.object({
  type: z.literal("Feature"),
  geometry: z.any(), // GeoJSON MultiPolygon — consommé tel quel par deck.gl.
  properties: irisPropertiesSchema,
})

export const irisCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(irisFeature),
})

export type IrisFeature = z.infer<typeof irisFeature>
export type IrisFeatureCollection = z.infer<typeof irisCollectionSchema>

// --- Chemin et fetch --------------------------------------------------------------

/** Chemin d'artefact du GeoJSON IRIS d'un département. */
export const irisPath = (codeDepartement: string) =>
  `choropleth/iris-high/${codeDepartement}.geojson`

/**
 * IRIS d'un département. Un 404 est normal (département sans commune
 * multi-IRIS : ~104 fichiers pour ~101 départements) -> collection vide,
 * cachée comme un succès par react-query (pas de retry).
 */
export async function fetchIrisDept(
  base: string,
  dept: string,
): Promise<IrisFeatureCollection> {
  const url = artifactUrl(base, irisPath(dept))
  const res = await fetch(url)
  if (res.status === 404) return { type: "FeatureCollection", features: [] }
  if (!res.ok) throw new Error(`CDN ${url} -> ${res.status} ${res.statusText}`)
  const fc = irisCollectionSchema.parse(await res.json())
  for (const f of fc.features) f.geometry = normalizeGeometry(f.geometry)
  return fc
}

// --- Mapping métriques (carte score) ----------------------------------------------

// Les noms diffèrent de la maille commune ; les métriques absentes (dimensions
// n_*, prix maison/appart) masquent la couche : la commune reste la lecture.
export const IRIS_METRIC_KEYS = {
  score_valeur: "score_commune",
  gap_pondere: "gap_pondere_iris",
  prix: "prix_m2_median",
} as const satisfies Partial<Record<Metric, keyof IrisProperties>>

/** La métrique de la carte score existe-t-elle à la maille IRIS ? */
export const hasIrisMetric = (metric: Metric): boolean =>
  metric in IRIS_METRIC_KEYS

/** Valeur IRIS d'une métrique de la carte score (null si non mappée). */
export function irisMetricValue(p: IrisProperties, metric: Metric): number | null {
  const key = IRIS_METRIC_KEYS[metric as keyof typeof IRIS_METRIC_KEYS]
  return key ? (p[key] as number | null) : null
}
