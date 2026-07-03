import { z } from "zod"

import type { Lod } from "@/lib/dvf"

// Base URL de l'API civic (transport/politique). En dev, /civic-api est relayé
// vers le service FastAPI civic (port 8001) par le proxy Vite.
const CIVIC_API_URL = import.meta.env.VITE_CIVIC_API_URL ?? "/civic-api"

export type Orientation =
  | "gauche"
  | "ecologiste"
  | "centre"
  | "droite"
  | "extreme_droite"
  | "divers"
  | "sans_etiquette"
  | "inconnu"

export type RouteType = "ALL" | "bus" | "tramway" | "métro" | "train" | "autres"

// --- Schémas zod --------------------------------------------------------------

const politiqueProperties = z.object({
  orientation: z.string(),
  nuance: z.string().nullable().optional(),
  maire_nom: z.string().nullable().optional(),
  maire_prenom: z.string().nullable().optional(),
  liste: z.string().nullable().optional(),
  participation: z.number().nullable().optional(),
  tour_decisif: z.number().nullable().optional(),
  pct_voix_exprimes: z.number().nullable().optional(),
  // Répartition par famille (maille département uniquement).
  par_orientation: z.record(z.string(), z.number()).optional(),
  nb_communes: z.number().optional(),
  nom: z.string().nullable().optional(),
  code_commune: z.string().optional(),
  code_departement: z.string().optional(),
})

const transportProperties = z.object({
  route_type: z.string(),
  nb_stations: z.number().nullable(),
  population: z.number().nullable().optional(),
  stations_per_1000hab: z.number().nullable(),
  nom: z.string().nullable().optional(),
  code_commune: z.string().optional(),
  code_departement: z.string().optional(),
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

const politiqueCollection = featureCollection(politiqueProperties)
const transportCollection = featureCollection(transportProperties)
const stationsCollection = featureCollection(stationProperties)

export type PolitiqueCollection = z.infer<typeof politiqueCollection>
export type PolitiqueFeature = PolitiqueCollection["features"][number]
export type TransportCollection = z.infer<typeof transportCollection>
export type TransportFeature = TransportCollection["features"][number]
export type StationsCollection = z.infer<typeof stationsCollection>
export type StationFeature = StationsCollection["features"][number]

// --- Appels --------------------------------------------------------------------

async function fetchGeoJson(
  path: string,
  params: Record<string, string | undefined>,
): Promise<unknown> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, v)
  }
  const res = await fetch(`${CIVIC_API_URL}${path}?${qs.toString()}`)
  if (!res.ok) {
    throw new Error(`API ${path} -> ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function fetchPolitiqueCommunes(
  lod: Lod,
  codeDepartement?: string,
): Promise<PolitiqueCollection> {
  return politiqueCollection.parse(
    await fetchGeoJson("/v1/politique/communes", {
      lod,
      code_departement: codeDepartement,
    }),
  )
}

export async function fetchPolitiqueDepartements(
  lod: Lod = "low",
): Promise<PolitiqueCollection> {
  return politiqueCollection.parse(
    await fetchGeoJson("/v1/politique/departements", { lod }),
  )
}

export async function fetchTransportCommunes(
  routeType: RouteType,
  lod: Lod,
  codeDepartement?: string,
): Promise<TransportCollection> {
  return transportCollection.parse(
    await fetchGeoJson("/v1/transport/communes", {
      route_type: routeType,
      lod,
      code_departement: codeDepartement,
    }),
  )
}

export async function fetchTransportStations(
  bbox: [number, number, number, number],
  routeType?: RouteType,
): Promise<StationsCollection> {
  return stationsCollection.parse(
    await fetchGeoJson("/v1/transport/stations", {
      bbox: bbox.join(","),
      route_type: routeType === "ALL" ? undefined : routeType,
    }),
  )
}
