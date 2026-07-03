import { useMemo, useState } from "react"
import DeckGL from "@deck.gl/react"
import { GeoJsonLayer, ScatterplotLayer } from "deck.gl"
import { WebMercatorViewport, type MapViewState } from "@deck.gl/core"
import Map from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { lodForZoom, meshForZoom } from "@/store/filters"
import {
  fetchPolitiqueCommunes,
  fetchPolitiqueDepartements,
  fetchTransportCommunes,
  fetchTransportStations,
  type PolitiqueFeature,
  type RouteType,
  type StationFeature,
  type TransportFeature,
} from "@/lib/civic"
import {
  ORIENTATION_COLORS,
  ORIENTATION_LABELS,
  makeTransportScale,
  orientationColor,
  routeTypeColor,
} from "@/lib/civicColors"

/** Vue initiale, surchageable par l'URL (?lng=3.88&lat=43.6&zoom=12). */
function initialViewState(): MapViewState {
  const qs = new URLSearchParams(window.location.search)
  const num = (k: string) => {
    const v = Number(qs.get(k))
    return Number.isFinite(v) && qs.has(k) ? v : undefined
  }
  return {
    longitude: num("lng") ?? 2.4,
    latitude: num("lat") ?? 46.6,
    zoom: num("zoom") ?? 5,
  }
}

const INITIAL_VIEW_STATE: MapViewState = initialViewState()

type Dataset = "politique" | "transport"
const ROUTE_TYPES: RouteType[] = ["ALL", "bus", "tramway", "métro", "train", "autres"]
// Au-delà de ce zoom, la couche points des arrêts est affichée (bbox viewport).
const STATIONS_MIN_ZOOM = 11

const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] }

/** Bbox du viewport, arrondie pour stabiliser la clé de cache react-query. */
function viewportBbox(vs: MapViewState): [number, number, number, number] {
  const vp = new WebMercatorViewport({
    ...vs,
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [[minLon, minLat], [maxLon, maxLat]] = [
    vp.unproject([0, window.innerHeight]),
    vp.unproject([window.innerWidth, 0]),
  ]
  const r = (v: number) => Math.round(v * 50) / 50 // pas de 0.02°
  return [r(minLon - 0.02), r(minLat - 0.02), r(maxLon + 0.02), r(maxLat + 0.02)]
}

export default function CivicMap() {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE)
  const [dataset, setDataset] = useState<Dataset>(() =>
    new URLSearchParams(window.location.search).get("dataset") === "transport"
      ? "transport"
      : "politique",
  )
  const [routeType, setRouteType] = useState<RouteType>("ALL")
  const [hovered, setHovered] = useState<
    PolitiqueFeature | TransportFeature | StationFeature | null
  >(null)

  const zoom = viewState.zoom ?? 5
  const mesh = meshForZoom(zoom)
  // LOD plafonné à mid : on charge la France entière (pas de filtre bbox/dept),
  // et le niveau 50 m sur ~35k communes (~50 Mo) bloque le main thread.
  const rawLod = lodForZoom(zoom)
  const lod = rawLod === "high" ? "mid" : rawLod

  // --- Données politique (maille selon zoom) ---------------------------------
  const politique = useQuery({
    queryKey: ["politique", mesh, lod],
    queryFn: () =>
      mesh === "communes"
        ? fetchPolitiqueCommunes(lod)
        : fetchPolitiqueDepartements(lod),
    enabled: dataset === "politique",
  })

  // --- Données transport (communes uniquement) -------------------------------
  const transport = useQuery({
    queryKey: ["transport", routeType, lod],
    queryFn: () => fetchTransportCommunes(routeType, lod),
    enabled: dataset === "transport",
  })

  const bbox = useMemo(
    () => viewportBbox(viewState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewState.longitude, viewState.latitude, viewState.zoom],
  )
  const stations = useQuery({
    queryKey: ["stations", bbox, routeType],
    queryFn: () => fetchTransportStations(bbox, routeType),
    enabled: dataset === "transport" && zoom >= STATIONS_MIN_ZOOM,
  })

  const transportScale = useMemo(
    () => makeTransportScale(transport.data?.features ?? []),
    [transport.data],
  )

  // --- Couches deck.gl ---------------------------------------------------------
  const layers = useMemo(() => {
    if (dataset === "politique") {
      return [
        new GeoJsonLayer<PolitiqueFeature["properties"]>({
          id: `politique-${mesh}-${lod}`,
          data: politique.data ?? EMPTY_COLLECTION,
          filled: true,
          stroked: true,
          getFillColor: (f) =>
            orientationColor((f as PolitiqueFeature).properties.orientation),
          getLineColor: [255, 255, 255, 120],
          lineWidthMinPixels: 0.5,
          pickable: true,
          onHover: (info) =>
            setHovered((info.object as PolitiqueFeature) ?? null),
        }),
      ]
    }
    const choropleth = new GeoJsonLayer<TransportFeature["properties"]>({
      id: `transport-${routeType}-${lod}`,
      data: transport.data ?? EMPTY_COLLECTION,
      filled: true,
      stroked: true,
      getFillColor: (f) => transportScale(f as TransportFeature),
      getLineColor: [255, 255, 255, 120],
      lineWidthMinPixels: 0.5,
      pickable: true,
      onHover: (info) => setHovered((info.object as TransportFeature) ?? null),
      updateTriggers: { getFillColor: [transportScale] },
    })
    if (zoom < STATIONS_MIN_ZOOM) return [choropleth]
    const points = new ScatterplotLayer<StationFeature>({
      id: "transport-stations",
      data: stations.data?.features ?? [],
      getPosition: (f) => f.geometry.coordinates as [number, number],
      getFillColor: (f) => routeTypeColor(f.properties.route_type),
      getRadius: 18,
      radiusMinPixels: 3,
      radiusMaxPixels: 10,
      pickable: true,
      onHover: (info) => setHovered((info.object as StationFeature) ?? null),
    })
    return [choropleth, points]
  }, [dataset, mesh, lod, routeType, zoom, politique.data, transport.data, stations.data, transportScale])

  const isLoading =
    dataset === "politique" ? politique.isLoading : transport.isLoading

  return (
    <div className="relative h-svh w-svw overflow-hidden bg-background text-foreground">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={layers}
        onViewStateChange={(e) => setViewState(e.viewState as MapViewState)}
        style={{ width: "100%", height: "100%" }}
      >
        <Map mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" />
      </DeckGL>

      {/* Panneau de contrôle */}
      <div className="absolute top-4 left-4 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Retour à l'accueil">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <span className="font-display text-lg font-bold tracking-tight">
            Homepedia<span className="text-accent">.</span>
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          {(["politique", "transport"] as Dataset[]).map((d) => (
            <Button
              key={d}
              size="sm"
              variant={d === dataset ? "default" : "outline"}
              className={
                d === dataset
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : undefined
              }
              onClick={() => setDataset(d)}
            >
              {d === "politique" ? "Municipales 2026" : "Transports"}
            </Button>
          ))}
        </div>

        {dataset === "politique" ? (
          <>
            <div className="mt-3 text-sm font-semibold">
              Orientation politique —{" "}
              {mesh === "communes" ? "communes" : "départements"}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {Object.entries(ORIENTATION_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="inline-block size-2.5 rounded-sm"
                    style={{
                      backgroundColor: `rgba(${ORIENTATION_COLORS[key].join(",")})`,
                    }}
                  />
                  {label}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 text-sm font-semibold">
              Stations pour 1 000 habitants
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ROUTE_TYPES.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={t === routeType ? "default" : "outline"}
                  className={
                    t === routeType
                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                      : undefined
                  }
                  onClick={() => setRouteType(t)}
                >
                  {t === "ALL" ? "Tous" : t}
                </Button>
              ))}
            </div>
            {zoom < STATIONS_MIN_ZOOM && (
              <div className="mt-2 text-xs text-muted-foreground">
                Zoomez pour voir les arrêts individuels
              </div>
            )}
          </>
        )}
        {isLoading && (
          <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
        )}
      </div>

      {/* Tooltip au survol */}
      {hovered && (
        <div className="absolute bottom-4 left-4 max-w-72 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur">
          {"orientation" in hovered.properties ? (
            <>
              <div className="font-display font-semibold">
                {hovered.properties.nom ?? hovered.properties.code_commune}
              </div>
              <div className="mt-1">
                <span
                  className="mr-1.5 inline-block size-2.5 rounded-sm"
                  style={{
                    backgroundColor: `rgba(${orientationColor(hovered.properties.orientation).join(",")})`,
                  }}
                />
                {ORIENTATION_LABELS[hovered.properties.orientation] ??
                  hovered.properties.orientation}
                {hovered.properties.nuance ? ` (${hovered.properties.nuance})` : ""}
              </div>
              {hovered.properties.maire_nom && (
                <div>
                  Maire :{" "}
                  <span className="font-semibold">
                    {hovered.properties.maire_prenom}{" "}
                    {hovered.properties.maire_nom}
                  </span>
                </div>
              )}
              {hovered.properties.liste && (
                <div className="truncate text-muted-foreground">
                  {hovered.properties.liste}
                </div>
              )}
              {hovered.properties.participation != null && (
                <div className="text-muted-foreground">
                  Participation : {hovered.properties.participation.toFixed(1)} %
                </div>
              )}
            </>
          ) : "stations_per_1000hab" in hovered.properties ? (
            <>
              <div className="font-display font-semibold">
                {hovered.properties.nom ?? hovered.properties.code_commune}
              </div>
              <div className="mt-1">
                <span className="font-semibold text-accent">
                  {hovered.properties.stations_per_1000hab ?? "—"}
                </span>{" "}
                stations / 1 000 hab
              </div>
              <div className="text-muted-foreground">
                {hovered.properties.nb_stations ?? 0} stations
                {hovered.properties.population
                  ? ` — ${hovered.properties.population.toLocaleString("fr-FR")} hab`
                  : ""}
              </div>
            </>
          ) : (
            <>
              <div className="font-display font-semibold">
                {hovered.properties.station_name ?? "Arrêt"}
              </div>
              <div className="text-muted-foreground">
                {hovered.properties.route_type ?? "?"} —{" "}
                {hovered.properties.nb_lignes ?? "?"} ligne(s)
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
