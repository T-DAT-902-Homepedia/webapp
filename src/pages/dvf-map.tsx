import { useMemo, useState } from "react"
import DeckGL from "@deck.gl/react"
import { GeoJsonLayer } from "deck.gl"
import type { MapViewState } from "@deck.gl/core"
import Map from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useChoropleth } from "@/hooks/useChoropleth"
import { lodForZoom, meshForZoom, useFilters } from "@/store/filters"
import type { ChoroplethFeature, TypeLocal } from "@/lib/dvf"
import { makeColorScale } from "@/lib/colorScale"

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 2.4,
  latitude: 46.6,
  zoom: 5,
}

const TYPES: TypeLocal[] = ["Appartement", "Maison"]

// Hoistée hors du composant : identité stable pour deck.gl pendant le chargement
// (un littéral inline recréerait la couche à chaque render).
const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] }

export default function DvfMap() {
  const [zoom, setZoom] = useState(INITIAL_VIEW_STATE.zoom ?? 5)
  const [hovered, setHovered] = useState<ChoroplethFeature | null>(null)

  const typeLocal = useFilters((s) => s.typeLocal)
  const setTypeLocal = useFilters((s) => s.setTypeLocal)

  const mesh = meshForZoom(zoom)
  const lod = lodForZoom(zoom)

  const { data, isLoading } = useChoropleth(mesh, typeLocal, lod)

  const colorScale = useMemo(
    () => makeColorScale(data?.features ?? []),
    [data],
  )

  const layer = useMemo(
    () =>
      new GeoJsonLayer<ChoroplethFeature["properties"]>({
        id: `choropleth-${mesh}-${typeLocal}-${lod}`,
        data: data ?? EMPTY_COLLECTION,
        filled: true,
        stroked: true,
        getFillColor: (f) => colorScale(f as ChoroplethFeature),
        getLineColor: [255, 255, 255, 120],
        lineWidthMinPixels: 0.5,
        pickable: true,
        onHover: (info) =>
          setHovered((info.object as ChoroplethFeature) ?? null),
        // colorScale change avec les données : il doit déclencher le recalcul
        // des couleurs (sinon deck.gl garde l'ancienne palette en cache).
        updateTriggers: { getFillColor: [colorScale, typeLocal] },
      }),
    [data, colorScale, mesh, typeLocal, lod],
  )

  return (
    <div className="relative h-svh w-svw overflow-hidden bg-background text-foreground">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={[layer]}
        onViewStateChange={(e) =>
          setZoom((e.viewState as MapViewState).zoom ?? zoom)
        }
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
        <div className="mt-3 text-sm font-semibold">
          Prix au m² — {mesh === "communes" ? "communes" : "départements"}
        </div>
        <div className="mt-2 flex gap-2">
          {TYPES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={t === typeLocal ? "default" : "outline"}
              className={
                t === typeLocal
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : undefined
              }
              onClick={() => setTypeLocal(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        {isLoading && (
          <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
        )}
      </div>

      {/* Tooltip au survol */}
      {hovered && (
        <div className="absolute bottom-4 left-4 max-w-72 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur">
          <div className="font-display font-semibold">
            {hovered.properties.nom ??
              hovered.properties.code_commune ??
              hovered.properties.code_departement}
          </div>
          <div className="mt-1">
            Médiane :{" "}
            <span className="font-semibold text-accent">
              {hovered.properties.prix_m2_median != null
                ? `${Math.round(hovered.properties.prix_m2_median).toLocaleString("fr-FR")} €/m²`
                : "—"}
            </span>
          </div>
          <div className="text-muted-foreground">
            {hovered.properties.nb_transactions.toLocaleString("fr-FR")}{" "}
            transactions
            {hovered.properties.fiable ? "" : " (faible volume)"}
          </div>
        </div>
      )}
    </div>
  )
}
