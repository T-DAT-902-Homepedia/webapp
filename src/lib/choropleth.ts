import { z } from "zod"

import { artifactUrl, fetchJson } from "@/lib/data"

export type TypeLocal = "Maison" | "Appartement" // PR2 le remplace par TypeLocalFilter
export type Lod = "low" | "mid" | "high"
export type Mesh = "departements" | "communes"

// --- Schémas zod : valident les GeoJSON choroplèthe du CDN ---------------------

// Le GeoJSON contient les trois familles de colonnes (tous types, maison, appart) :
// changer de type de local ne déclenche aucun refetch, uniquement un recalcul de
// couleurs côté client (cf. statsForType).
export const choroplethPropertiesSchema = z.object({
  code_departement: z.string(),
  nom: z.string(),
  prix_m2_median: z.number().nullable(),
  nb_transactions: z.number(),
  fiable: z.boolean(),
  maison_prix_m2_median: z.number().nullable(),
  maison_nb_transactions: z.number(),
  maison_fiable: z.boolean(),
  appart_prix_m2_median: z.number().nullable(),
  appart_nb_transactions: z.number(),
  appart_fiable: z.boolean(),
  // Maille commune uniquement :
  code_commune: z.string().optional(),
  score_valeur: z.number().nullable().optional(),
  gap_pondere: z.number().nullable().optional(),
})
export type ChoroplethProperties = z.infer<typeof choroplethPropertiesSchema>

const feature = z.object({
  type: z.literal("Feature"),
  geometry: z.any(), // GeoJSON MultiPolygon — consommé tel quel par deck.gl.
  properties: choroplethPropertiesSchema,
})

export const featureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(feature),
})

export type ChoroplethFeatureCollection = z.infer<typeof featureCollectionSchema>
export type ChoroplethFeature = z.infer<typeof feature>

// --- Normalisation géométrie ----------------------------------------------------

type Geometry = { type: string; coordinates?: unknown; geometries?: Geometry[] }

/**
 * La simplification du pipeline produit parfois des GeometryCollection (polygone
 * réel + LineString parasites), que deck.gl GeoJsonLayer ne sait pas rendre. On
 * n'en garde que les membres polygonaux, fusionnés en MultiPolygon si besoin.
 */
export function normalizeGeometry(geom: Geometry | null): Geometry | null {
  if (!geom || geom.type !== "GeometryCollection") return geom
  const polygons: unknown[] = []
  for (const g of geom.geometries ?? []) {
    if (g.type === "Polygon") polygons.push(g.coordinates)
    else if (g.type === "MultiPolygon") polygons.push(...(g.coordinates as unknown[]))
  }
  if (polygons.length === 0) return null
  return { type: "MultiPolygon", coordinates: polygons }
}

// --- Chemins d'artefacts --------------------------------------------------------

/** Mapping (mesh, lod) -> chemin d'artefact. PR1 : high communes clampé à mid. */
export function choroplethPath(mesh: Mesh, lod: Lod, codeDepartement?: string): string {
  if (mesh === "departements")
    return `choropleth/departements-${lod === "low" ? "low" : "mid"}.geojson`
  if (lod === "high" && codeDepartement)
    return `choropleth/communes-high/${codeDepartement}.geojson` // utilisé à partir de PR3
  return `choropleth/communes-mid.geojson`
}

export async function fetchChoropleth(
  base: string,
  mesh: Mesh,
  lod: Lod,
  codeDepartement?: string,
): Promise<ChoroplethFeatureCollection> {
  const fc = await fetchJson(
    artifactUrl(base, choroplethPath(mesh, lod, codeDepartement)),
    featureCollectionSchema,
  )
  for (const f of fc.features) f.geometry = normalizeGeometry(f.geometry)
  return fc
}

// --- Stats par type de local ------------------------------------------------------

/** Stats du type de local courant, dérivées des properties préfixées. */
export function statsForType(
  p: ChoroplethProperties,
  t: TypeLocal,
): { prix: number | null; nb: number; fiable: boolean } {
  if (t === "Maison")
    return { prix: p.maison_prix_m2_median, nb: p.maison_nb_transactions, fiable: p.maison_fiable }
  return { prix: p.appart_prix_m2_median, nb: p.appart_nb_transactions, fiable: p.appart_fiable }
}
