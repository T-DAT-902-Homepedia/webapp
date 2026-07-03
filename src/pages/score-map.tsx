import { useMemo, useState } from "react"
import { GeoJsonLayer, type Layer } from "deck.gl"
import type { MapViewState } from "@deck.gl/core"
import { MapboxOverlay } from "@deck.gl/mapbox"
import Map, { useControl } from "react-map-gl/maplibre"
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
import { ScoreSidebar, type Basemap } from "@/components/score-sidebar"

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 2.4,
  latitude: 46.6,
  zoom: 5,
}

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
  const [basemap, setBasemap] = useState<Basemap>("clair")
  const [fillBeforeId, setFillBeforeId] = useState<string | undefined>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ["score"],
    queryFn: fetchScore,
    staleTime: Infinity, // fichier statique : jamais périmé en session.
  })

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
      // metric + scale doivent déclencher le recalcul des couleurs (sinon
      // deck.gl garde l'ancienne palette en cache).
      updateTriggers: { getFillColor: [scale, metric] },
    })
    return [choropleth]
  }, [data, scale, metric, opacity, fillBeforeId])

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
        isLoading={isLoading}
        isError={isError}
      />

      <div className="relative flex-1">
        <Map
          initialViewState={INITIAL_VIEW_STATE}
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
      </div>
    </div>
  )
}
