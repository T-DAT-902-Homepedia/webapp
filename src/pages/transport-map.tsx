import { useMemo, useState } from "react"
import { GeoJsonLayer, type Layer } from "deck.gl"
import { type MapViewState } from "@deck.gl/core"
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
  type GeometryFeature,
  type ValuesMap,
} from "@/lib/transport"
import { makeTransportScale, TRANSPORT_PALETTE } from "@/lib/transportColors"

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

const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] }
const EMPTY_VALUES: ValuesMap = {}

// Libellés en français : on remplace le champ texte des calques de symboles par
// le nom FR du tuile vectorielle (fallback latin puis nom par défaut).
const FR_LABEL = [
  "coalesce",
  ["get", "name:fr"],
  ["get", "name:latin"],
  ["get", "name"],
]

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
  const [fillBeforeId, setFillBeforeId] = useState<string | undefined>()
  const [basemap, setBasemap] = useState<Basemap>("clair")
  const [hovered, setHovered] = useState<GeometryFeature | null>(null)

  const zoom = viewState.zoom ?? 5
  // LOD plafonné à mid : on charge la France entière (pas de filtre bbox/dept),
  // et le niveau 50 m sur ~35k communes bloque le main thread.
  const rawLod = lodForZoom(zoom)
  const lod = rawLod === "high" ? "mid" : rawLod

  // Géométrie : chargée une fois par LOD.
  const geometry = useQuery({
    queryKey: ["transport-geometry", lod],
    queryFn: () => fetchTransportGeometry(lod),
  })

  // Valeurs : densité d'arrêts par commune (payload léger).
  const values = useQuery({
    queryKey: ["transport-values"],
    queryFn: () => fetchTransportValues(),
  })
  const valuesData = values.data ?? EMPTY_VALUES

  const transportScale = useMemo(
    () =>
      makeTransportScale(
        Object.values(valuesData).map((v) => v.densite_arrets_km2),
      ),
    [valuesData],
  )

  // --- Couche deck.gl ----------------------------------------------------------
  const layers = useMemo(() => {
    // La géométrie reste stable (uploadée une fois au GPU) ; la couleur vient du
    // lookup `valuesData` dans getFillColor. beforeId place la couche sous les
    // labels (interleaving maplibre).
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
            ?.densite_arrets_km2,
        ),
      getLineColor: [255, 255, 255, 120],
      lineWidthMinPixels: 0.5,
      pickable: true,
      onHover: (info) => setHovered((info.object as GeometryFeature) ?? null),
      updateTriggers: { getFillColor: [transportScale, valuesData] },
    })
    return [choropleth]
  }, [lod, fillBeforeId, geometry.data, valuesData, transportScale])

  const isLoading = geometry.isLoading || values.isLoading
  const hoveredValue = hovered?.properties.code_commune
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
    setFillBeforeId(symbols[0]?.id)
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
          Densité du réseau — arrêts / km²
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
        {isLoading && (
          <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
        )}
      </div>

      {/* Tooltip au survol */}
      {hovered && (
        <div className="absolute bottom-4 left-4 max-w-72 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur">
          <div className="font-display font-semibold">
            {hovered.properties.nom ?? hovered.properties.code_commune}
          </div>
          <div className="mt-1">
            <span className="font-semibold text-accent">
              {hoveredValue?.densite_arrets_km2 ?? "—"}
            </span>{" "}
            arrêts / km²
          </div>
          <div className="text-muted-foreground">
            {hoveredValue?.nb_arrets ?? 0} arrêts
          </div>
        </div>
      )}
    </div>
  )
}
