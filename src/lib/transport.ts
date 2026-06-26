import { z } from "zod"

import type { Lod } from "@/lib/dvf"

// Le transport est servi par l'API principale (port 8000), comme DVF — pas de
// service distinct. Surchargeable via VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL ?? "/api"

// Version de schéma : ajoutée à l'URL (param `v`, ignoré par l'API) pour invalider
// le cache HTTP quand la FORME des données change (ex. Paris -> arrondissements).
// À incrémenter à chaque changement de structure géométrie/valeurs.
const SCHEMA_VERSION = "2"

export type RouteType = "ALL" | "bus" | "tramway" | "métro" | "train" | "autres"

// --- Schémas zod --------------------------------------------------------------

// Géométrie communale seule (statique, identique pour tous les modes).
const geometryProperties = z.object({
  code_commune: z.string(),
  nom: z.string().nullable().optional(),
  code_departement: z.string().optional(),
})

// Valeurs par commune pour un mode (map légère {code_commune: {...}}).
const communeValue = z.object({
  nom: z.string().nullable().optional(),
  nb_stations: z.number().nullable(),
  population: z.number().nullable().optional(),
  stations_per_1000hab: z.number().nullable(),
  // Densité spatiale du réseau (stations/km²) — métrique d'accessibilité affichée.
  stations_per_km2: z.number().nullable(),
})

const stationProperties = z.object({
  station_name: z.string().nullable(),
  route_type: z.string().nullable(),
  nb_lignes: z.number().nullable(),
  code_commune: z.string().nullable(),
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
const stationsCollection = featureCollection(stationProperties)
const valuesMap = z.record(z.string(), communeValue)

export type GeometryCollection = z.infer<typeof geometryCollection>
export type GeometryFeature = GeometryCollection["features"][number]
export type CommuneValue = z.infer<typeof communeValue>
export type ValuesMap = z.infer<typeof valuesMap>
export type StationsCollection = z.infer<typeof stationsCollection>
export type StationFeature = StationsCollection["features"][number]

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

/** Contours communaux seuls — chargés une fois par LOD, réutilisés tous modes. */
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

/** Valeurs par commune pour un mode — rechargées à chaque changement de mode. */
export async function fetchTransportValues(
  routeType: RouteType,
  codeDepartement?: string,
): Promise<ValuesMap> {
  return valuesMap.parse(
    await fetchJson("/v1/transport/communes/values", {
      route_type: routeType,
      code_departement: codeDepartement,
      v: SCHEMA_VERSION,
    }),
  )
}

export async function fetchTransportStations(
  bbox: [number, number, number, number],
  routeType?: RouteType,
): Promise<StationsCollection> {
  return stationsCollection.parse(
    await fetchJson("/v1/transport/stations", {
      bbox: bbox.join(","),
      route_type: routeType === "ALL" ? undefined : routeType,
    }),
  )
}
