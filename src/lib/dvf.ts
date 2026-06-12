import { z } from "zod"

import { apiUrl } from "@/lib/api"

export type TypeLocal = "Maison" | "Appartement"
export type Lod = "low" | "mid" | "high"

// --- Schémas zod : valident la FeatureCollection renvoyée par l'API ----------

const featureProperties = z.object({
  prix_m2_median: z.number().nullable(),
  prix_m2_p25: z.number().nullable().optional(),
  prix_m2_p75: z.number().nullable().optional(),
  nb_transactions: z.number(),
  fiable: z.boolean(),
  nom: z.string().nullable().optional(),
  // Présent selon la maille (commune vs département).
  code_commune: z.string().optional(),
  code_departement: z.string().optional(),
})

const feature = z.object({
  type: z.literal("Feature"),
  geometry: z.any(), // GeoJSON MultiPolygon — consommé tel quel par deck.gl.
  properties: featureProperties,
})

export const featureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(feature),
})

export type ChoroplethFeatureCollection = z.infer<typeof featureCollectionSchema>
export type ChoroplethFeature = z.infer<typeof feature>

// --- Appels ------------------------------------------------------------------

async function fetchChoropleth(
  path: string,
  params: Record<string, string | undefined>,
): Promise<ChoroplethFeatureCollection> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, v)
  }
  const res = await fetch(`${apiUrl(path)}?${qs.toString()}`)
  if (!res.ok) {
    throw new Error(`API ${path} -> ${res.status} ${res.statusText}`)
  }
  return featureCollectionSchema.parse(await res.json())
}

export function fetchChoroplethDepartements(
  typeLocal: TypeLocal,
  lod: Lod = "low",
): Promise<ChoroplethFeatureCollection> {
  return fetchChoropleth("/v1/choropleth/departements", {
    type_local: typeLocal,
    lod,
  })
}

export function fetchChoroplethCommunes(
  typeLocal: TypeLocal,
  lod: Lod,
  codeDepartement?: string,
): Promise<ChoroplethFeatureCollection> {
  return fetchChoropleth("/v1/choropleth/communes", {
    type_local: typeLocal,
    lod,
    code_departement: codeDepartement,
  })
}
