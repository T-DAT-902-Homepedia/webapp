import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { GeoJsonLayer, ScatterplotLayer, type Layer } from "deck.gl"
import type { MapViewState, PickingInfo } from "@deck.gl/core"
import { MapboxOverlay } from "@deck.gl/mapbox"
import Map, { useControl, type MapRef } from "react-map-gl/maplibre"
import type {
  IControl,
  Map as MaplibreMap,
  StyleSpecification,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useQuery } from "@tanstack/react-query"

import {
  DIMENSIONS,
  DIVERGING_METRICS,
  fetchScore,
  METRIC_LABELS,
  type Metric,
  type ScoreFeature,
} from "@/lib/score"
import { makeDivergingScale, makeSequentialScale } from "@/lib/scoreColors"
import { ScoreSidebar, type Basemap, type MapView } from "@/components/score-sidebar"
import { loadWordCloud, type CityWordCloud } from "@/lib/parseAvis"
import WordCloudPopup from "@/components/WordCloudPopup"
import { CommunePanel } from "@/components/commune-panel"

// Centre (bbox) d'une géométrie GeoJSON, pour recentrer sur une commune au
// deep-link. Parcourt récursivement les coordonnées (Polygon / MultiPolygon).
function geometryCenter(geom: ScoreFeature["geometry"]): [number, number] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as [number, number]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    } else if (Array.isArray(c)) {
      c.forEach(visit)
    }
  }
  visit((geom as { coordinates: unknown }).coordinates)
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 2.4,
  latitude: 46.6,
  zoom: 5,
}

// Dézoom plafonné : au-delà on ne verrait plus que l'océan autour de la France.
const MIN_ZOOM = 4

// Identité stable pour deck.gl pendant le chargement (un littéral inline
// recréerait la couche à chaque render).
const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] }

// Ordre du sélecteur : score global, écart qualité/prix, puis les 12 dimensions.
const METRICS: Metric[] = ["score_valeur", "gap_pondere", ...DIMENSIONS]

// Imagerie aérienne Esri (raster, sans clé) pour le fond « Satellite ».
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs:
    "https://basemaps.cartocdn.com/gl/positron-gl-style/{fontstack}/{range}.pbf",
  sources: {
    "esri-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tuiles © Esri — Source : Esri, Maxar, Earthstar Geographics, GIS User Community",
    },
  },
  layers: [{ id: "esri-imagery", type: "raster", source: "esri-imagery" }],
}

// Fonds de carte : Carto (vecteur, schéma OpenMapTiles -> labels FR) + satellite.
const BASEMAP_STYLES: Record<Basemap, string | StyleSpecification> = {
  clair: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  sombre: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  couleur: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  satellite: SATELLITE_STYLE,
}

// Libellés en français : on remplace le champ texte des calques de symboles par
// le nom FR de la tuile vectorielle (fallback latin puis nom par défaut).
const FR_LABEL = [
  "coalesce",
  ["get", "name:fr"],
  ["get", "name:latin"],
  ["get", "name"],
]

/** Formate une valeur de métrique pour l'affichage (gap signé, reste en 0–1). */
function fmt(metric: Metric, v: number | null | undefined): string {
  if (v == null) return "—"
  if (metric === "gap_pondere") return (v >= 0 ? "+" : "") + v.toFixed(2)
  return v.toFixed(2)
}

/** Overlay deck.gl interleavé : les couches s'insèrent DANS la pile maplibre
 *  (via beforeId), donc sous les labels du fond de carte qui restent lisibles. */
function DeckOverlay({ layers }: { layers: Layer[] }) {
  const overlay = useControl(
    () => new MapboxOverlay({ interleaved: true, layers }) as unknown as IControl,
  )
  ;(overlay as unknown as MapboxOverlay).setProps({ layers })
  return null
}

export default function ScoreMap() {
  const [hovered, setHovered] = useState<ScoreFeature | null>(null)
  const [metric, setMetric] = useState<Metric>("score_valeur")
  const [opacity, setOpacity] = useState(0.8)
  const [basemap, setBasemap] = useState<Basemap>("satellite")
  const [fillBeforeId, setFillBeforeId] = useState<string | undefined>()
  const [wordCloudEnabled, setWordCloudEnabled] = useState(false)
  const [selectedCity, setSelectedCity] = useState<CityWordCloud | null>(null)
  const mapRef = useRef<MapRef>(null)

  // Recentre la carte (France métro ou un DROM) via une animation flyTo.
  const centerOn = (view: MapView) =>
    mapRef.current?.flyTo({ center: view.center, zoom: view.zoom, duration: 1200 })

  const { data, isLoading, isError } = useQuery({
    queryKey: ["score"],
    queryFn: fetchScore,
    staleTime: Infinity, // fichier statique : jamais périmé en session.
  })

  const { data: cities } = useQuery({
    queryKey: ["wordcloud"],
    queryFn: loadWordCloud,
    staleTime: Infinity,
    enabled: wordCloudEnabled,
  })

  // Commune sélectionnée = source de vérité dans l'URL (?commune=<code>), pour un
  // deep-link partageable et rechargeable.
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedCode = searchParams.get("commune")
  const selected = useMemo(
    () =>
      selectedCode
        ? (data?.features.find(
            (f) => f.properties.code_commune === selectedCode,
          ) ?? null)
        : null,
    [data, selectedCode],
  )

  const selectCommune = (code: string) => setSearchParams({ commune: code })
  const closePanel = () => setSearchParams({})

  // Échap ferme le panneau.
  useEffect(() => {
    if (!selectedCode) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePanel()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode])

  // Deep-link : au 1er chargement des données, si l'URL cible une commune, on
  // recentre dessus. Ne se redéclenche pas aux clics suivants (dep [data]).
  const didDeepLinkCenter = useRef(false)
  useEffect(() => {
    if (!data || didDeepLinkCenter.current) return
    didDeepLinkCenter.current = true
    if (selected) {
      mapRef.current?.flyTo({ center: geometryCenter(selected.geometry), zoom: 11, duration: 0 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const diverging = DIVERGING_METRICS.has(metric)

  // Échelle recalculée quand la métrique ou les données changent.
  const scale = useMemo(() => {
    const values = (data?.features ?? []).map((f) => f.properties[metric])
    return diverging ? makeDivergingScale(values) : makeSequentialScale(values)
  }, [data, metric, diverging])

  const layers = useMemo(() => {
    const choropleth = new GeoJsonLayer<ScoreFeature["properties"]>({
      id: "score-choropleth",
      data: data ?? EMPTY_COLLECTION,
      // beforeId glisse la couche sous les labels (prop runtime de @deck.gl/mapbox,
      // non typée en v8) ; spread conditionnel pour éviter l'erreur de type.
      ...(fillBeforeId ? { beforeId: fillBeforeId } : {}),
      filled: true,
      stroked: true,
      opacity,
      getFillColor: (f) => scale((f as ScoreFeature).properties[metric]),
      getLineColor: [255, 255, 255, 120],
      lineWidthMinPixels: 0.5,
      pickable: true,
      onHover: (info) => setHovered((info.object as ScoreFeature) ?? null),
      onClick: (info) =>
        info.object &&
        selectCommune((info.object as ScoreFeature).properties.code_commune),
      // metric + scale doivent déclencher le recalcul des couleurs (sinon
      // deck.gl garde l'ancienne palette en cache).
      updateTriggers: { getFillColor: [scale, metric] },
    })

    // Contour de la commune sélectionnée, au-dessus (ambre, visible sur tout fond).
    const highlight = new GeoJsonLayer({
      id: "score-selected",
      data: selected
        ? { type: "FeatureCollection" as const, features: [selected] }
        : EMPTY_COLLECTION,
      filled: false,
      stroked: true,
      getLineColor: [245, 158, 11, 255],
      lineWidthMinPixels: 3,
      pickable: false,
    })

    if (!wordCloudEnabled || !cities) return [choropleth, highlight]

    const wordCloudLayer = new ScatterplotLayer<CityWordCloud>({
      id: "wordcloud-cities",
      data: cities,
      getPosition: (c) => [c.lng, c.lat],
      getFillColor: [99, 102, 241, 220],
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 1.5,
      stroked: true,
      radiusUnits: "pixels",
      getRadius: 7,
      pickable: true,
      onClick: (info: PickingInfo) =>
        setSelectedCity((info.object as CityWordCloud) ?? null),
    })
    return [choropleth, highlight, wordCloudLayer]
  }, [data, scale, metric, opacity, fillBeforeId, selected, wordCloudEnabled, cities])

  const hoveredValue = hovered?.properties[metric]

  // À chaque (re)chargement de style — initial OU changement de fond — repasse les
  // labels en français et mémorise le 1er calque de symboles (beforeId). Le
  // satellite (raster, sans symbole) court-circuite : pas de FR, couche au-dessus.
  function syncMapStyle(map: MaplibreMap) {
    const styleLayers = map.getStyle()?.layers ?? []
    const symbols = styleLayers.filter((l) => l.type === "symbol")
    if (symbols.length === 0) {
      setFillBeforeId(undefined)
      return
    }
    const fr = JSON.stringify(FR_LABEL)
    // Idempotent : on ne réécrit que si un libellé n'est pas déjà en FR, sinon
    // nos setLayoutProperty re-déclencheraient styledata en boucle.
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
    setFillBeforeId(symbols[0]?.id)
  }

  return (
    <div className="flex h-svh w-svw overflow-hidden bg-background text-foreground">
      <ScoreSidebar
        metrics={METRICS}
        metric={metric}
        onMetric={setMetric}
        diverging={diverging}
        opacity={opacity}
        onOpacity={setOpacity}
        basemap={basemap}
        onBasemap={setBasemap}
        onCenter={centerOn}
        isLoading={isLoading}
        isError={isError}
        wordCloudEnabled={wordCloudEnabled}
        onWordCloudEnabled={setWordCloudEnabled}
      />

      <div className="relative flex-1">
        <Map
          ref={mapRef}
          initialViewState={INITIAL_VIEW_STATE}
          minZoom={MIN_ZOOM}
          mapStyle={BASEMAP_STYLES[basemap]}
          // Rechargement complet au changement de fond (les styles Carto partagent
          // les mêmes ids ; le diff laisserait des libellés anglais résiduels).
          styleDiffing={false}
          onStyleData={(e) => syncMapStyle(e.target)}
          style={{ width: "100%", height: "100%" }}
        >
          <DeckOverlay layers={layers} />
        </Map>

        {/* Tooltip au survol */}
        {hovered && (
          <div className="absolute bottom-4 left-4 max-w-72 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur">
            <div className="font-display font-semibold">
              {hovered.properties.nom ?? hovered.properties.code_commune}
              {hovered.properties.dep ? ` (${hovered.properties.dep})` : ""}
            </div>
            <div className="mt-1">
              {METRIC_LABELS[metric]} :{" "}
              <span className="font-semibold text-accent">
                {fmt(metric, hoveredValue)}
              </span>
            </div>
            <div className="text-muted-foreground">
              {hovered.properties.prix != null
                ? `${Math.round(hovered.properties.prix).toLocaleString("fr-FR")} €/m²`
                : "prix n/d"}
            </div>
          </div>
        )}

        {selectedCity && (
          <div
            onClick={() => setSelectedCity(null)}
            className="fixed inset-0 z-[999] bg-black/45"
          />
        )}
        {selectedCity && (
          <WordCloudPopup city={selectedCity} onClose={() => setSelectedCity(null)} />
        )}
      </div>

      {/* Panneau de détail de la commune sélectionnée (clic) */}
      {selected && <CommunePanel feature={selected} onClose={closePanel} />}
    </div>
  )
}
