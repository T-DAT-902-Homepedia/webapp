import { useEffect, useMemo, useState } from "react"
import DeckGL from "@deck.gl/react"
import { ContourLayer, GeoJsonLayer, HeatmapLayer, ScatterplotLayer } from "deck.gl"
import { WebMercatorViewport, type MapViewState } from "@deck.gl/core"
import Map from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { Checkbox } from "radix-ui"
import { Check, ChevronRight } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { MapTopBar } from "@/components/map-top-bar"
import { useChoropleth } from "@/hooks/useChoropleth"
import {
  HIGH_ZOOM_THRESHOLD,
  useCommunesHigh,
  useVisibleDepartements,
} from "@/hooks/useCommunesHigh"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useMeta } from "@/hooks/useMeta"
import { usePoints } from "@/hooks/usePoints"
import {
  lodForZoom,
  meshForZoom,
  useFilters,
  type Representation,
} from "@/store/filters"
import {
  statsForType,
  type ChoroplethFeature,
  type ChoroplethProperties,
  type TypeLocal,
} from "@/lib/choropleth"
import { featureBbox, featureCentroids, type Bbox } from "@/lib/centroids"
import { makeColorScale, quantileScale, quantileThresholds } from "@/lib/colorScale"
import { PRICE_SEQ } from "@/lib/palettes"
import {
  BubbleLegend,
  HeatLegend,
  QuantileLegend,
} from "@/components/map-legend"
import { formatEuroM2, formatInt, formatSigned } from "@/lib/format"
import { cn } from "@/lib/utils"

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 2.4,
  latitude: 46.6,
  zoom: 5,
}

const TYPES: TypeLocal[] = ["Tous", "Maison", "Appartement"]

const REPRESENTATIONS: { id: Representation; label: string }[] = [
  { id: "choropleth", label: "Choroplèthe" },
  { id: "bubbles", label: "Bulles" },
  { id: "heat", label: "Heatmap" },
]

// Hoistée hors du composant : identité stable pour deck.gl pendant le chargement
// (un littéral inline recréerait la couche à chaque render).
const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] }

const MESH_LABEL = { regions: "régions", departements: "départements", communes: "communes" }

// Au-delà de ce zoom, la heatmap laisse place aux mutations individuelles.
const POINTS_ZOOM = 11

// --- État dans l'URL (partage/refresh, audit N4) ----------------------------
// v=lat,lng,zoom ; repr= ; type= ; poids= ; iso=1

function parseViewParam(v: string | null): MapViewState | null {
  if (!v) return null
  const [lat, lng, zoom] = v.split(",").map(Number)
  if ([lat, lng, zoom].some((n) => !Number.isFinite(n))) return null
  return { latitude: lat, longitude: lng, zoom }
}

const viewParam = (v: MapViewState) =>
  `${(v.latitude ?? 0).toFixed(4)},${(v.longitude ?? 0).toFixed(4)},${(v.zoom ?? 5).toFixed(2)}`

/** Étape du fil d'Ariane de drill-down (retour par fitBounds mémorisé). */
interface DrillStep {
  label: string
  view: MapViewState
}

export default function DvfMap() {
  const [params, setParams] = useSearchParams()
  const [viewState, setViewState] = useState<MapViewState>(
    () => parseViewParam(params.get("v")) ?? INITIAL_VIEW_STATE,
  )
  const [hovered, setHovered] = useState<ChoroplethFeature | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<{ prix: number; t: string } | null>(
    null,
  )
  const [drillPath, setDrillPath] = useState<DrillStep[]>([])
  const navigate = useNavigate()

  const typeLocal = useFilters((s) => s.typeLocal)
  const setTypeLocal = useFilters((s) => s.setTypeLocal)
  const representation = useFilters((s) => s.representation)
  const setRepresentation = useFilters((s) => s.setRepresentation)
  // Pondération de la heatmap : densité de ventes ou niveau de prix.
  const [heatWeight, setHeatWeight] = useState<"ventes" | "prix">(() =>
    params.get("poids") === "prix" ? "prix" : "ventes",
  )
  const [contours, setContours] = useState(() => params.get("iso") === "1")

  // Filtres du store initialisés depuis l'URL (une fois, au montage).
  useEffect(() => {
    const repr = params.get("repr")
    if (repr === "bubbles" || repr === "heat" || repr === "choropleth") {
      useFilters.setState({ representation: repr })
    }
    const type = params.get("type")
    if (type === "Maison" || type === "Appartement" || type === "Tous") {
      useFilters.setState({ typeLocal: type })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const zoom = viewState.zoom ?? 5
  const mesh = meshForZoom(zoom)
  const lod = lodForZoom(zoom)
  // Zoom débouncé pour les tailles adaptatives (évite un rebuild de couche
  // par frame de zoom) et l'écriture de l'URL.
  const debouncedView = useDebouncedValue(viewState, 300)
  const zoomDebounced = debouncedView.zoom ?? zoom

  // L'URL reflète l'état courant (replace : pas de spam de l'historique).
  useEffect(() => {
    const next = new URLSearchParams()
    next.set("v", viewParam(debouncedView))
    if (representation !== "choropleth") next.set("repr", representation)
    if (typeLocal !== "Tous") next.set("type", typeLocal)
    if (representation === "heat") {
      if (heatWeight !== "ventes") next.set("poids", heatWeight)
      if (contours) next.set("iso", "1")
    }
    setParams(next, { replace: true })
  }, [debouncedView, representation, typeLocal, heatWeight, contours, setParams])

  // Dézoom manuel : le fil d'Ariane se tronque au niveau réellement visible.
  useEffect(() => {
    if (mesh === "regions") setDrillPath([])
    else if (mesh === "departements") setDrillPath((path) => path.slice(0, 1))
  }, [mesh])

  const { isError: metaError } = useMeta()
  const { data, isLoading } = useChoropleth(mesh, lod)
  const heat = representation === "heat"
  const { data: points, isLoading: pointsLoading } = usePoints(heat)

  // Contours fins (50m) des seuls départements visibles au zoom élevé, la
  // maille mid restant affichée dessous (fallback sans flash). Bounds
  // débouncés : on ne déclenche pas un fetch à chaque frame de pan.
  const highEnabled =
    representation === "choropleth" && mesh === "communes" && zoom >= HIGH_ZOOM_THRESHOLD
  const bounds = useMemo<Bbox | null>(() => {
    if (!highEnabled) return null
    // deck.gl v8 : getBounds() renvoie un tableau plat [minX, minY, maxX, maxY].
    const [minLng, minLat, maxLng, maxLat] = new WebMercatorViewport({
      ...viewState,
      width: window.innerWidth,
      height: window.innerHeight,
    }).getBounds()
    return [minLng, minLat, maxLng, maxLat]
  }, [highEnabled, viewState])
  const debouncedBounds = useDebouncedValue(bounds, 200)
  const visibleDepts = useVisibleDepartements(debouncedBounds)
  const high = useCommunesHigh(visibleDepts, highEnabled)

  // Drill-down : clic sur une région/un département -> cadrage sur son emprise
  // (la maille suivante prend le relais via meshForZoom) ; sur une commune ->
  // fiche détaillée.
  const onFeatureClick = (f: ChoroplethFeature | undefined) => {
    if (!f) return
    if (f.properties.code_commune) {
      navigate(`/commune/${f.properties.code_commune}`)
      return
    }
    const bbox = featureBbox(f)
    if (!bbox) return
    const viewport = new WebMercatorViewport({
      ...viewState,
      width: window.innerWidth,
      height: window.innerHeight,
    })
    const target = viewport.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: 48 },
    )
    const nextView: MapViewState = {
      ...viewState,
      longitude: target.longitude,
      latitude: target.latitude,
      // Garantit le changement de maille même sur les grandes emprises (DROM).
      zoom: Math.max(target.zoom, f.properties.code_region != null ? 5.6 : 8.1),
      transitionDuration: 600,
    }
    setViewState(nextView)
    const step: DrillStep = { label: f.properties.nom, view: nextView }
    setDrillPath((path) =>
      f.properties.code_region != null ? [step] : [...path.slice(0, 1), step],
    )
  }

  // Retour à une étape du fil d'Ariane (index -1 = France entière).
  const goToStep = (index: number) => {
    setDrillPath((path) => path.slice(0, index + 1))
    setViewState(
      index < 0
        ? { ...INITIAL_VIEW_STATE, transitionDuration: 600 }
        : { ...drillPath[index].view, transitionDuration: 600 },
    )
  }

  // Accessors mémoïsés : changer de type recolore la couche sans la recréer ni
  // refetcher (le GeoJSON contient les trois familles de colonnes).
  const getValue = useMemo(
    () => (p: ChoroplethProperties) => statsForType(p, typeLocal).prix,
    [typeLocal],
  )
  const getFiable = useMemo(
    () => (p: ChoroplethProperties) => statsForType(p, typeLocal).fiable,
    [typeLocal],
  )

  const colorScale = useMemo(
    () => makeColorScale(data?.features ?? [], getValue, getFiable),
    [data, getValue, getFiable],
  )

  // Centres des features pour les bulles (mémoïsé par jeu de données).
  const centroids = useMemo(
    () => (representation === "bubbles" ? featureCentroids(data?.features ?? []) : []),
    [representation, data],
  )
  const maxNb = useMemo(
    () =>
      Math.max(
        1,
        ...centroids.map((c) => statsForType(c.feature.properties, typeLocal).nb),
      ),
    [centroids, typeLocal],
  )

  // Points de mutations filtrés par type (heatmap).
  const heatPoints = useMemo(() => {
    if (!heat || !points) return []
    if (typeLocal === "Tous") return points
    const t = typeLocal === "Maison" ? "M" : "A"
    return points.filter((p) => p.t === t)
  }, [heat, points, typeLocal])

  // À fort zoom en mode heat : les points individuels remplacent le halo,
  // colorés par prix (mêmes quantiles YlOrRd que la choroplèthe).
  const showPoints = heat && zoomDebounced >= POINTS_ZOOM
  const pointColor = useMemo(() => {
    if (!showPoints) return null
    const values = heatPoints.map((pt) => pt.prix)
    return {
      color: quantileScale(values, PRICE_SEQ),
      thresholds: quantileThresholds(values, PRICE_SEQ.length),
    }
  }, [showPoints, heatPoints])

  const layers = useMemo(() => {
    if (heat) {
      if (showPoints && pointColor) {
        return [
          new ScatterplotLayer({
            id: "transactions-points",
            data: heatPoints,
            getPosition: (pt: { lon: number; lat: number }) => [pt.lon, pt.lat],
            getFillColor: (pt: { prix: number }) => pointColor.color(pt.prix),
            radiusUnits: "pixels",
            getRadius: 4,
            stroked: true,
            getLineColor: [255, 255, 255, 160],
            lineWidthMinPixels: 0.5,
            pickable: true,
            onHover: (info) =>
              setHoveredPoint(
                (info.object as { prix: number; t: string } | undefined) ?? null,
              ),
            updateTriggers: { getFillColor: [pointColor] },
          }),
        ]
      }
      const heatmap = new HeatmapLayer({
        id: "transactions-heatmap",
        data: heatPoints,
        getPosition: (p: { lon: number; lat: number }) => [p.lon, p.lat],
        getWeight:
          heatWeight === "prix" ? (p: { prix: number }) => p.prix : () => 1,
        // Rayon resserré à mesure que l'on zoome : le halo reste local.
        radiusPixels: Math.min(45, Math.max(15, 60 - 4 * zoomDebounced)),
        aggregation: "SUM",
      })
      if (!contours) return [heatmap]
      // Isolignes de densité (nb de ventes par cellule d'environ 4 km).
      const contour = new ContourLayer({
        id: "transactions-contours",
        data: heatPoints,
        getPosition: (p: { lon: number; lat: number }) => [p.lon, p.lat],
        cellSize: 4000,
        contours: [
          { threshold: 5, color: [8, 81, 156, 160], strokeWidth: 1 },
          { threshold: 25, color: [49, 130, 189, 200], strokeWidth: 2 },
          { threshold: 100, color: [222, 45, 38, 220], strokeWidth: 3 },
        ],
      })
      return [heatmap, contour]
    }

    const choropleth = new GeoJsonLayer<ChoroplethFeature["properties"]>({
      // id stable par (mesh, lod) : un changement de couleur ne doit jamais
      // reconstruire la couche, seulement repasser dans getFillColor.
      id: `choropleth-${mesh}-${lod}`,
      data: data ?? EMPTY_COLLECTION,
      filled: true,
      stroked: true,
      // En mode bulles, la choroplèthe devient un simple fond de repérage.
      opacity: representation === "bubbles" ? 0.15 : 1,
      getFillColor: (f) => colorScale.getColor(f as ChoroplethFeature),
      getLineColor: [255, 255, 255, 120],
      lineWidthMinPixels: 0.5,
      pickable: true,
      onHover: (info) => setHovered((info.object as ChoroplethFeature) ?? null),
      onClick: (info) => onFeatureClick(info.object as ChoroplethFeature | undefined),
      // colorScale change d'identité quand (data, typeLocal) changent : c'est
      // lui qui déclenche le recalcul des couleurs.
      updateTriggers: { getFillColor: [colorScale] },
    })

    if (representation === "choropleth") {
      if (!highEnabled || high.features.length === 0) return [choropleth]
      // Même échelle de couleurs que la maille mid nationale : une commune a
      // la même couleur en mid et en high.
      const highLayer = new GeoJsonLayer<ChoroplethFeature["properties"]>({
        id: "choropleth-communes-high",
        data: { type: "FeatureCollection" as const, features: high.features },
        filled: true,
        stroked: true,
        getFillColor: (f) => colorScale.getColor(f as ChoroplethFeature),
        getLineColor: [255, 255, 255, 150],
        lineWidthMinPixels: 0.5,
        pickable: true,
        onHover: (info) => setHovered((info.object as ChoroplethFeature) ?? null),
        onClick: (info) =>
          onFeatureClick(info.object as ChoroplethFeature | undefined),
        updateTriggers: { getFillColor: [colorScale] },
      })
      return [choropleth, highLayer]
    }

    const bubbles = new ScatterplotLayer({
      id: `bubbles-${mesh}`,
      data: centroids,
      getPosition: (c: (typeof centroids)[number]) => c.position,
      // Aire proportionnelle au volume (racine du nb de transactions).
      getRadius: (c: (typeof centroids)[number]) =>
        Math.sqrt(statsForType(c.feature.properties, typeLocal).nb / maxNb),
      // Taille continue selon le zoom (débouncé) : plus de saut de palier
      // entre les mailles, les bulles gardent une emprise écran stable.
      radiusScale: 3000 * 2 ** (8.5 - zoomDebounced),
      radiusMinPixels: 1,
      radiusMaxPixels: 80,
      getFillColor: (c: (typeof centroids)[number]) =>
        colorScale.getColor(c.feature),
      stroked: true,
      getLineColor: [255, 255, 255, 180],
      lineWidthMinPixels: 0.5,
      pickable: true,
      onHover: (info) =>
        setHovered(
          ((info.object as (typeof centroids)[number] | undefined)?.feature ??
            null) as ChoroplethFeature | null,
        ),
      onClick: (info) =>
        onFeatureClick(
          (info.object as (typeof centroids)[number] | undefined)?.feature,
        ),
      updateTriggers: {
        getFillColor: [colorScale],
        getRadius: [typeLocal, maxNb],
      },
    })
    return [choropleth, bubbles]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    colorScale,
    mesh,
    lod,
    representation,
    centroids,
    maxNb,
    typeLocal,
    heat,
    heatPoints,
    heatWeight,
    contours,
    highEnabled,
    high.features,
    zoomDebounced,
    showPoints,
    pointColor,
  ])

  const hoveredStats = hovered ? statsForType(hovered.properties, typeLocal) : null
  const loading = isLoading || (heat && pointsLoading)

  return (
    <div className="relative h-svh w-svw overflow-hidden bg-background text-foreground">
      <MapTopBar
        extra={
          <Button variant="ghost" size="sm" asChild className="max-md:hidden">
            <Link to={`/map?v=${viewParam(debouncedView)}`}>
              Voir en qualité de vie
            </Link>
          </Button>
        }
      />
      <DeckGL
        viewState={viewState}
        onViewStateChange={(e) => setViewState(e.viewState as MapViewState)}
        controller
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
        style={{ width: "100%", height: "100%" }}
      >
        <Map mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" />
      </DeckGL>

      {/* Panneau de contrôle */}
      <div className="absolute top-16 left-4 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
        <div className="text-sm font-semibold">
          Prix au m² — {heat ? (showPoints ? "mutations (points)" : "mutations") : MESH_LABEL[mesh]}
        </div>

        {/* Fil d'Ariane du drill-down : on sait où on est, on peut remonter. */}
        {!heat && (
          <nav aria-label="Niveau de zoom" className="mt-1.5 flex flex-wrap items-center gap-0.5 text-xs">
            <button
              type="button"
              onClick={() => goToStep(-1)}
              className={cn(
                "rounded px-1 py-0.5 transition-colors hover:bg-muted",
                drillPath.length === 0
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              France
            </button>
            {drillPath.map((step, i) => (
              <span key={step.label} className="flex items-center gap-0.5">
                <ChevronRight className="size-3 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => goToStep(i)}
                  className={cn(
                    "rounded px-1 py-0.5 transition-colors hover:bg-muted",
                    i === drillPath.length - 1
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </button>
              </span>
            ))}
          </nav>
        )}

        <div className="mt-2 flex gap-1.5">
          {REPRESENTATIONS.map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={r.id === representation ? "accent" : "outline"}
              onClick={() => setRepresentation(r.id)}
            >
              {r.label}
            </Button>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5">
          {TYPES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={t === typeLocal ? "accent" : "outline"}
              onClick={() => setTypeLocal(t)}
            >
              {t}
            </Button>
          ))}
        </div>

        {heat && (
          <div className="mt-2 space-y-1.5 border-t pt-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Pondération</span>
              {(["ventes", "prix"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setHeatWeight(w)}
                  className={
                    w === heatWeight
                      ? "rounded border border-accent bg-accent/10 px-2 py-0.5 font-semibold text-accent"
                      : "rounded border border-input px-2 py-0.5 text-muted-foreground hover:bg-muted"
                  }
                >
                  {w === "ventes" ? "Ventes" : "Prix"}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
              <Checkbox.Root
                checked={contours}
                onCheckedChange={(v) => setContours(v === true)}
                className="flex size-4 shrink-0 items-center justify-center rounded border border-input bg-background data-[state=checked]:border-accent data-[state=checked]:bg-accent"
              >
                <Checkbox.Indicator>
                  <Check className="size-3 text-accent-foreground" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              Isolignes de densité
            </label>
          </div>
        )}

        {!heat && mesh !== "communes" && (
          <p className="mt-2 max-w-52 text-xs text-muted-foreground">
            Cliquez sur une {mesh === "regions" ? "région" : "département"} pour
            zoomer, sur une commune pour ouvrir sa fiche.
          </p>
        )}

        {metaError && (
          <div className="mt-2 max-w-52 text-xs text-destructive">
            Données indisponibles — réessayez plus tard.
          </div>
        )}
        {loading && !metaError && (
          <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
        )}
      </div>

      {/* Légende (bornes réelles de l'échelle courante) */}
      <div className="absolute right-4 bottom-4 flex flex-col items-end gap-2">
        {heat ? (
          showPoints && pointColor ? (
            <QuantileLegend
              title="Mutations (prix €/m²)"
              thresholds={pointColor.thresholds}
              palette={PRICE_SEQ}
              format={(v) => formatInt(v)}
            />
          ) : (
            <HeatLegend
              weightLabel={heatWeight === "prix" ? "pondérée par le prix" : "nombre de ventes"}
              contours={contours}
            />
          )
        ) : (
          <>
            {representation === "bubbles" && <BubbleLegend maxValue={maxNb} />}
            <QuantileLegend
              title={`Prix médian (€/m²)${typeLocal !== "Tous" ? ` — ${typeLocal.toLowerCase()}s` : ""}`}
              thresholds={colorScale.thresholds}
              palette={colorScale.palette}
              format={(v) => formatInt(v)}
              footer={
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Couleur atténuée : moins de 5 ventes.
                </p>
              }
            />
          </>
        )}
      </div>

      {/* Tooltip mutation individuelle (mode heat zoomé) */}
      {showPoints && hoveredPoint && (
        <div className="absolute bottom-4 left-4 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur">
          <span className="font-semibold text-accent">
            {formatEuroM2(hoveredPoint.prix)}
          </span>{" "}
          <span className="text-muted-foreground">
            · {hoveredPoint.t === "M" ? "maison" : "appartement"}
          </span>
        </div>
      )}

      {/* Tooltip au survol */}
      {!heat && hovered && hoveredStats && (
        <div className="absolute bottom-4 left-4 max-w-72 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur pointer-coarse:hidden">
          <div className="font-display font-semibold">
            {hovered.properties.nom}
          </div>
          <div className="mt-1">
            Médiane{typeLocal !== "Tous" ? ` (${typeLocal.toLowerCase()})` : ""} :{" "}
            <span className="font-semibold text-accent">
              {formatEuroM2(hoveredStats.prix)}
            </span>
          </div>
          <div className="text-muted-foreground">
            {formatInt(hoveredStats.nb)} transactions
            {hoveredStats.fiable ? "" : " (faible volume)"}
          </div>
          {hovered.properties.score_median != null && (
            <div className="text-muted-foreground">
              Score médian : {Math.round(hovered.properties.score_median * 100)} / 100
              {hovered.properties.gap_pondere_median != null &&
                ` · écart ${formatSigned(hovered.properties.gap_pondere_median)}`}
            </div>
          )}
          {hovered.properties.code_commune && (
            <div className="mt-1 text-xs text-muted-foreground">
              Cliquer pour ouvrir la fiche
            </div>
          )}
        </div>
      )}
    </div>
  )
}
