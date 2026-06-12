import { useMemo, useState } from "react"
import DeckGL from "@deck.gl/react"
import { GeoJsonLayer } from "deck.gl"
import type { MapViewState } from "@deck.gl/core"
import Map from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"

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
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
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
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          background: "rgba(255,255,255,0.95)",
          borderRadius: 12,
          padding: "12px 16px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          Prix au m² — {mesh === "communes" ? "communes" : "départements"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeLocal(t)}
              style={{
                padding: "4px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                cursor: "pointer",
                background: t === typeLocal ? "#bd0026" : "#fff",
                color: t === typeLocal ? "#fff" : "#333",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {isLoading && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
            Chargement…
          </div>
        )}
      </div>

      {/* Tooltip au survol */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
            maxWidth: 280,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {hovered.properties.nom ??
              hovered.properties.code_commune ??
              hovered.properties.code_departement}
          </div>
          <div>
            Médiane :{" "}
            {hovered.properties.prix_m2_median != null
              ? `${Math.round(hovered.properties.prix_m2_median).toLocaleString("fr-FR")} €/m²`
              : "—"}
          </div>
          <div>
            {hovered.properties.nb_transactions.toLocaleString("fr-FR")}{" "}
            transactions
            {hovered.properties.fiable ? "" : " (faible volume)"}
          </div>
        </div>
      )}
    </div>
  )
}
