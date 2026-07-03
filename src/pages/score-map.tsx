import { useMemo, useState } from "react"
import DeckGL from "@deck.gl/react"
import { GeoJsonLayer } from "deck.gl"
import type { MapViewState } from "@deck.gl/core"
import Map from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  DIMENSIONS,
  DIVERGING_METRICS,
  fetchScore,
  METRIC_LABELS,
  type Metric,
  type ScoreFeature,
} from "@/lib/score"
import {
  DIV_LEGEND,
  makeDivergingScale,
  makeSequentialScale,
  SEQ_LEGEND,
} from "@/lib/scoreColors"

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

/** Formate une valeur de métrique pour l'affichage (gap signé, reste en 0–1). */
function fmt(metric: Metric, v: number | null | undefined): string {
  if (v == null) return "—"
  if (metric === "gap_pondere") return (v >= 0 ? "+" : "") + v.toFixed(2)
  return v.toFixed(2)
}

export default function ScoreMap() {
  const [hovered, setHovered] = useState<ScoreFeature | null>(null)
  const [metric, setMetric] = useState<Metric>("score_valeur")

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

  const layer = useMemo(
    () =>
      new GeoJsonLayer<ScoreFeature["properties"]>({
        id: "score-choropleth",
        data: data ?? EMPTY_COLLECTION,
        filled: true,
        stroked: true,
        opacity: 0.8,
        getFillColor: (f) => scale((f as ScoreFeature).properties[metric]),
        getLineColor: [255, 255, 255, 120],
        lineWidthMinPixels: 0.5,
        pickable: true,
        onHover: (info) => setHovered((info.object as ScoreFeature) ?? null),
        // metric + scale doivent déclencher le recalcul des couleurs (sinon
        // deck.gl garde l'ancienne palette en cache).
        updateTriggers: { getFillColor: [scale, metric] },
      }),
    [data, scale, metric],
  )

  const legend = diverging ? DIV_LEGEND : SEQ_LEGEND
  const hoveredValue = hovered?.properties[metric]

  return (
    <div className="relative h-svh w-svw overflow-hidden bg-background text-foreground">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={[layer]}
        style={{ width: "100%", height: "100%" }}
      >
        <Map mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" />
      </DeckGL>

      {/* Panneau de contrôle */}
      <div className="absolute top-4 left-4 w-64 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
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

        <div className="mt-3 text-sm font-semibold">Score territoire</div>
        <label className="mt-2 block text-xs text-muted-foreground" htmlFor="metric">
          Métrique affichée
        </label>
        <select
          id="metric"
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={metric}
          onChange={(e) => setMetric(e.target.value as Metric)}
        >
          {METRICS.map((m) => (
            <option key={m} value={m}>
              {METRIC_LABELS[m]}
            </option>
          ))}
        </select>

        {/* Légende du dégradé */}
        <div className="mt-3">
          <div className="flex h-2 overflow-hidden rounded-sm">
            {legend.map((c, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})` }}
              />
            ))}
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
            {diverging ? (
              <>
                <span>Cher</span>
                <span>Neutre</span>
                <span>Bon rapport</span>
              </>
            ) : (
              <>
                <span>Faible</span>
                <span>Élevé</span>
              </>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
        )}
        {isError && (
          <div className="mt-2 text-xs text-destructive">
            Données indisponibles
          </div>
        )}
      </div>

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
  )
}
