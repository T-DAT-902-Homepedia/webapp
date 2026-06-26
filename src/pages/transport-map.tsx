import { useMemo, useState } from "react"
import { GeoJsonLayer, ScatterplotLayer, type Layer } from "deck.gl"
import { WebMercatorViewport, type MapViewState } from "@deck.gl/core"
import { MapboxOverlay } from "@deck.gl/mapbox"
import Map, { useControl } from "react-map-gl/maplibre"
import type { IControl, Map as MaplibreMap } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { lodForZoom } from "@/store/filters"
import {
  fetchTransportGeometry,
  fetchTransportValues,
  fetchTransportStations,
  type GeometryFeature,
  type RouteType,
  type ValuesMap,
} from "@/lib/transport"
import {
  makeTransportScale,
  routeTypeColor,
  TRANSPORT_PALETTE,
} from "@/lib/transportColors"

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

// Fonds de carte Carto (vecteur, sans clé API, même schéma OpenMapTiles -> les
// labels FR et l'interleaving fonctionnent identiquement sur les trois).
const BASEMAPS = {
  clair: {
    label: "Clair",
    url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  },
  sombre: {
    label: "Sombre",
    url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
  couleur: {
    label: "Couleur",
    url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  },
} as const
type Basemap = keyof typeof BASEMAPS
const BASEMAP_KEYS = Object.keys(BASEMAPS) as Basemap[]

const ROUTE_TYPES: RouteType[] = ["ALL", "bus", "tramway", "métro", "train", "autres"]
// Modes réels (sans 'ALL'), pour la légende des points colorés par mode.
const REAL_MODES: RouteType[] = ["bus", "tramway", "métro", "train", "autres"]
// Au-delà de ce zoom, la couche points des arrêts est affichée (bbox viewport).
const STATIONS_MIN_ZOOM = 11

const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] }
const EMPTY_VALUES: ValuesMap = {}

// Priorité d'affichage des modes : un pôle d'échange (bus + métro au même point)
// est coloré par le mode le plus structurant.
const MODE_PRIORITY: Record<string, number> = {
  train: 4,
  "métro": 3,
  tramway: 2,
  bus: 1,
  autres: 0,
}

// Un arrêt rendu. Les arrêts partageant des coordonnées (1 ligne par mode dans
// les données) sont éclatés en petit éventail autour du point pour que chaque
// mode reste visible avec sa couleur (sinon ils se superposent exactement).
type StationPoint = {
  position: [number, number]
  route_type: string
  nb_lignes: number | null
  station_name: string | null
}

// Rayon de l'éventail (mètres) pour écarter les arrêts co-localisés multi-modes.
const FAN_RADIUS_M = 25

// Libellés en français : on remplace le champ texte des calques de symboles par
// le nom FR du tuile vectorielle (fallback latin puis nom par défaut).
const FR_LABEL = [
  "coalesce",
  ["get", "name:fr"],
  ["get", "name:latin"],
  ["get", "name"],
]

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

/** Overlay deck.gl interleavé : les couches s'insèrent DANS la pile maplibre
 *  (via beforeId), donc sous les labels du fond de carte qui restent lisibles. */
function DeckOverlay({ layers }: { layers: Layer[] }) {
  // MapboxOverlay implémente l'IControl de mapbox-gl ; react-map-gl/maplibre
  // attend celui de maplibre-gl (interfaces structurellement proches mais
  // nominalement distinctes) -> ponts par cast localisés.
  const overlay = useControl(
    () => new MapboxOverlay({ interleaved: true, layers }) as unknown as IControl,
  )
  ;(overlay as unknown as MapboxOverlay).setProps({ layers })
  return null
}

export default function TransportMap() {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE)
  // Id du premier calque de labels : sert de beforeId pour glisser la choroplèthe
  // sous les noms de villes. Connu seulement après le chargement du style.
  // Deux points d'insertion deck.gl dans la pile maplibre :
  // - fill   : sous le 1er symbole -> la choroplèthe passe sous routes ET labels
  //            (les routes restent visibles par-dessus la surface) ;
  // - point  : sous le 1er symbole situé APRÈS toutes les lignes -> les arrêts
  //            passent AU-DESSUS des routes (sinon elles les masquent) mais sous
  //            les labels.
  const [fillBeforeId, setFillBeforeId] = useState<string | undefined>()
  const [pointBeforeId, setPointBeforeId] = useState<string | undefined>()
  const [basemap, setBasemap] = useState<Basemap>("clair")
  const [routeType, setRouteType] = useState<RouteType>("ALL")
  const [hovered, setHovered] = useState<GeometryFeature | StationPoint | null>(
    null,
  )

  const zoom = viewState.zoom ?? 5
  // LOD plafonné à mid : on charge la France entière (pas de filtre bbox/dept),
  // et le niveau 50 m sur ~35k communes bloque le main thread.
  const rawLod = lodForZoom(zoom)
  const lod = rawLod === "high" ? "mid" : rawLod

  // Géométrie : chargée une fois par LOD, réutilisée pour tous les modes.
  const geometry = useQuery({
    queryKey: ["transport-geometry", lod],
    queryFn: () => fetchTransportGeometry(lod),
  })

  // Valeurs : rechargées (payload léger) à chaque changement de mode.
  const values = useQuery({
    queryKey: ["transport-values", routeType],
    queryFn: () => fetchTransportValues(routeType),
  })
  const valuesData = values.data ?? EMPTY_VALUES

  const bbox = useMemo(
    () => viewportBbox(viewState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewState.longitude, viewState.latitude, viewState.zoom],
  )
  const stations = useQuery({
    queryKey: ["transport-stations", bbox, routeType],
    queryFn: () => fetchTransportStations(bbox, routeType),
    enabled: zoom >= STATIONS_MIN_ZOOM,
  })

  const transportScale = useMemo(
    () =>
      makeTransportScale(
        Object.values(valuesData).map((v) => v.stations_per_km2),
      ),
    [valuesData],
  )

  // Éclate les arrêts partageant les mêmes coordonnées (1 ligne par mode dans les
  // données) en un petit éventail : chaque mode garde sa couleur et reste
  // survolable séparément (sinon ils se superposent exactement).
  const stationPoints = useMemo<StationPoint[]>(() => {
    // Regroupement par coordonnées (objet simple : `Map` = composant react-map-gl).
    const byPos: Record<
      string,
      {
        position: [number, number]
        station_name: string | null
        modes: { route_type: string; nb_lignes: number | null }[]
      }
    > = {}
    for (const f of stations.data?.features ?? []) {
      const position = f.geometry.coordinates as [number, number]
      const key = `${position[0]},${position[1]}`
      ;(byPos[key] ??= {
        position,
        station_name: f.properties.station_name,
        modes: [],
      }).modes.push({
        route_type: f.properties.route_type ?? "autres",
        nb_lignes: f.properties.nb_lignes,
      })
    }

    const out: StationPoint[] = []
    for (const g of Object.values(byPos)) {
      const n = g.modes.length
      if (n === 1) {
        out.push({ ...g.modes[0], position: g.position, station_name: g.station_name })
        continue
      }
      // Éventail : décalage en mètres -> degrés (visible en zoomant, fusionné en dézoom).
      const [lon, lat] = g.position
      const dLat = FAN_RADIUS_M / 111320
      const dLon = FAN_RADIUS_M / (111320 * Math.cos((lat * Math.PI) / 180))
      g.modes
        .sort(
          (a, b) =>
            (MODE_PRIORITY[b.route_type] ?? -1) - (MODE_PRIORITY[a.route_type] ?? -1),
        )
        .forEach((m, i) => {
          const ang = (i / n) * 2 * Math.PI
          out.push({
            position: [lon + Math.cos(ang) * dLon, lat + Math.sin(ang) * dLat],
            route_type: m.route_type,
            nb_lignes: m.nb_lignes,
            station_name: g.station_name,
          })
        })
    }
    return out
  }, [stations.data])

  // --- Couches deck.gl ---------------------------------------------------------
  const layers = useMemo(() => {
    // La géométrie reste stable (uploadée une fois au GPU) ; seule la couleur
    // change avec le mode, via le lookup `valuesData` dans getFillColor.
    // beforeId place la couche sous les labels (interleaving maplibre).
    const choropleth = new GeoJsonLayer<GeometryFeature["properties"]>({
      id: `transport-${lod}`,
      data: geometry.data ?? EMPTY_COLLECTION,
      // beforeId glisse la couche sous les labels (prop runtime de @deck.gl/mapbox,
      // non typée en v8) ; spread conditionnel pour éviter l'erreur de type.
      ...(fillBeforeId ? { beforeId: fillBeforeId } : {}),
      filled: true,
      stroked: true,
      // Semi-transparent : laisse voir le fond de carte choisi (sinon les
      // communes à densité 0, peintes en vert clair opaque, le masqueraient).
      opacity: 0.7,
      getFillColor: (f) =>
        transportScale(
          valuesData[(f as GeometryFeature).properties.code_commune]
            ?.stations_per_km2,
        ),
      getLineColor: [255, 255, 255, 120],
      lineWidthMinPixels: 0.5,
      pickable: true,
      onHover: (info) => setHovered((info.object as GeometryFeature) ?? null),
      updateTriggers: { getFillColor: [transportScale, valuesData] },
    })
    if (zoom < STATIONS_MIN_ZOOM) return [choropleth]
    const points = new ScatterplotLayer<StationPoint>({
      id: "transport-stations",
      data: stationPoints,
      ...(pointBeforeId ? { beforeId: pointBeforeId } : {}),
      getPosition: (d) => d.position,
      getFillColor: (d) => routeTypeColor(d.route_type),
      getRadius: 18,
      radiusMinPixels: 3,
      radiusMaxPixels: 10,
      pickable: true,
      onHover: (info) => setHovered((info.object as StationPoint) ?? null),
    })
    return [choropleth, points]
  }, [lod, zoom, fillBeforeId, pointBeforeId, geometry.data, valuesData, stationPoints, transportScale])

  // Légende des points : tous les modes si "Tous", sinon le mode sélectionné.
  const legendModes = routeType === "ALL" ? REAL_MODES : [routeType]

  const isLoading = geometry.isLoading || values.isLoading
  const hoveredValue =
    hovered && "properties" in hovered && hovered.properties.code_commune
      ? valuesData[hovered.properties.code_commune]
      : undefined

  // À chaque (re)chargement de style — initial OU changement de fond — repasse les
  // labels en français et mémorise le 1er calque de symboles (beforeId). Le
  // changement de fond recharge tout le style : sans ça les labels redeviendraient
  // anglais et la choroplèthe repasserait au-dessus. Idempotent : si le style est
  // déjà en FR on s'arrête (styledata se redéclenche, y compris après nos propres
  // setLayoutProperty -> évite la boucle).
  function syncMapStyle(map: MaplibreMap) {
    // NB : pas de garde `isStyleLoaded()` — avec les couches deck.gl interleaved
    // il reste durablement à false et bloquerait l'application du FR. styledata
    // ne se déclenche qu'au (re)chargement du style et sur nos setLayoutProperty,
    // donc le contrôle `needsFr` ci-dessous suffit à éviter la boucle.
    const styleLayers = map.getStyle()?.layers ?? []
    const symbols = styleLayers.filter((l) => l.type === "symbol")
    if (symbols.length === 0) return
    const fr = JSON.stringify(FR_LABEL)
    // Vérifie TOUS les calques (pas seulement le 1er) : il reste du travail dès
    // qu'un calque a un libellé encore non-FR. Sinon on s'arrête -> pas de boucle
    // (nos setLayoutProperty re-déclenchent styledata).
    const needsFr = symbols.some((l) => {
      const tf = map.getLayoutProperty(l.id, "text-field")
      return tf != null && JSON.stringify(tf) !== fr
    })
    if (needsFr) {
      for (const layer of symbols) {
        if (map.getLayoutProperty(layer.id, "text-field") == null) continue
        map.setLayoutProperty(layer.id, "text-field", FR_LABEL)
      }
    }
    // Points d'insertion : la choroplèthe sous le 1er symbole ; les arrêts sous
    // le 1er symbole situé après la dernière ligne (donc au-dessus des routes).
    let lastLine = -1
    styleLayers.forEach((l, i) => {
      if (l.type === "line") lastLine = i
    })
    setFillBeforeId(symbols[0]?.id)
    setPointBeforeId(
      styleLayers.find((l, i) => i > lastLine && l.type === "symbol")?.id ??
        symbols[0]?.id,
    )
  }

  return (
    <div className="relative h-svh w-svw overflow-hidden bg-background text-foreground">
      <Map
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle={BASEMAPS[basemap].url}
        // Rechargement complet au changement de fond (positron/dark/voyager
        // partagent les mêmes ids de calques ; le diff laisserait des libellés
        // anglais résiduels) -> syncMapStyle réapplique le FR proprement.
        styleDiffing={false}
        onMove={(e) => setViewState(e.viewState as MapViewState)}
        onStyleData={(e) => syncMapStyle(e.target)}
        style={{ width: "100%", height: "100%" }}
      >
        <DeckOverlay layers={layers} />
      </Map>

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

        <div className="mt-3 text-sm font-semibold">
          Densité du réseau — stations / km²
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

        {/* Légende du dégradé de densité (choroplèthe) */}
        <div className="mt-2">
          <div className="flex h-2 overflow-hidden rounded-sm">
            {TRANSPORT_PALETTE.map((c, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})` }}
              />
            ))}
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>Faible</span>
            <span>Élevée</span>
          </div>
        </div>

        <div className="mt-3 text-sm font-semibold">Fond de carte</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BASEMAP_KEYS.map((b) => (
            <Button
              key={b}
              size="sm"
              variant={b === basemap ? "default" : "outline"}
              className={
                b === basemap
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : undefined
              }
              onClick={() => setBasemap(b)}
            >
              {BASEMAPS[b].label}
            </Button>
          ))}
        </div>
        {zoom < STATIONS_MIN_ZOOM ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Zoomez pour voir les arrêts individuels
          </div>
        ) : (
          <>
            <div className="mt-3 text-sm font-semibold">Arrêts par mode</div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {legendModes.map((m) => {
                const [r, g, b] = routeTypeColor(m)
                return (
                  <div key={m} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: `rgb(${r},${g},${b})` }}
                    />
                    {m}
                  </div>
                )
              })}
            </div>
          </>
        )}
        {isLoading && (
          <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
        )}
      </div>

      {/* Tooltip au survol */}
      {hovered && (
        <div className="absolute bottom-4 left-4 max-w-72 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur">
          {"route_type" in hovered ? (
            <>
              <div className="font-display font-semibold">
                {hovered.station_name ?? "Arrêt"}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{
                    backgroundColor: `rgb(${routeTypeColor(hovered.route_type).slice(0, 3).join(",")})`,
                  }}
                />
                <span className="text-muted-foreground">
                  {hovered.route_type} — {hovered.nb_lignes ?? "?"} ligne(s)
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="font-display font-semibold">
                {hovered.properties.nom ?? hovered.properties.code_commune}
              </div>
              <div className="mt-1">
                <span className="font-semibold text-accent">
                  {hoveredValue?.stations_per_km2 ?? "—"}
                </span>{" "}
                stations / km²
              </div>
              <div className="text-muted-foreground">
                {hoveredValue?.nb_stations ?? 0} stations
                {hoveredValue?.population
                  ? ` — ${hoveredValue.population.toLocaleString("fr-FR")} hab`
                  : ""}
              </div>
              <div className="text-muted-foreground">
                {hoveredValue?.stations_per_1000hab ?? "—"} / 1 000 hab
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
