import { z } from "zod"

import type { Lod } from "@/lib/dvf"

// Le transport est servi par l'API principale (port 8000), comme DVF — pas de
// service distinct. Surchargeable via VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL ?? "/api"

// Version de schéma : ajoutée à l'URL (param `v`, ignoré par l'API) pour invalider
// le cache HTTP quand la FORME des données change (ex. Paris -> arrondissements).
// À incrémenter à chaque changement de structure géométrie/valeurs.
const SCHEMA_VERSION = "3"

// --- Schémas zod --------------------------------------------------------------

// Géométrie communale seule (statique).
const geometryProperties = z.object({
  code_commune: z.string(),
  nom: z.string().nullable().optional(),
  code_departement: z.string().optional(),
})

// Valeurs par commune : densité d'arrêts issue du silver duckpipe.
const communeValue = z.object({
  nb_arrets: z.number().nullable(),
  // Densité spatiale du réseau (arrêts/km²) — métrique de la choroplèthe.
  densite_arrets_km2: z.number().nullable(),
})

function featureCollection<P extends z.ZodTypeAny>(properties: P) {
  return z.object({
    type: z.literal("FeatureCollection"),
    features: z.array(
      z.object({
        type: z.literal("Feature"),
        geometry: z.any(), // GeoJSON — consommé tel quel par deck.gl.
        properties,
      }),
    ),
  })
}

const geometryCollection = featureCollection(geometryProperties)
const valuesMap = z.record(z.string(), communeValue)

export type GeometryCollection = z.infer<typeof geometryCollection>
export type GeometryFeature = GeometryCollection["features"][number]
export type CommuneValue = z.infer<typeof communeValue>
export type ValuesMap = z.infer<typeof valuesMap>

// --- Appels --------------------------------------------------------------------

async function fetchJson(
  path: string,
  params: Record<string, string | undefined>,
): Promise<unknown> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, v)
  }
  const res = await fetch(`${API_URL}${path}?${qs.toString()}`)
  if (!res.ok) {
    throw new Error(`API ${path} -> ${res.status} ${res.statusText}`)
  }
  return res.json()
}

/** Contours communaux seuls — chargés une fois par LOD. */
export async function fetchTransportGeometry(
  lod: Lod,
  codeDepartement?: string,
): Promise<GeometryCollection> {
  return geometryCollection.parse(
    await fetchJson("/v1/transport/communes/geometry", {
      lod,
      code_departement: codeDepartement,
      v: SCHEMA_VERSION,
    }),
  )
}

/** Densité d'arrêts par commune. */
export async function fetchTransportValues(
  codeDepartement?: string,
): Promise<ValuesMap> {
  return valuesMap.parse(
    await fetchJson("/v1/transport/communes/values", {
      code_departement: codeDepartement,
      v: SCHEMA_VERSION,
    }),
  )
}
