import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { GeoJsonLayer, ScatterplotLayer } from "deck.gl"
import type { MapViewState, PickingInfo } from "@deck.gl/core"
import Map, { type MapRef } from "react-map-gl/maplibre"
import type { Map as MaplibreMap } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import {
  DIMENSIONS,
  DIVERGING_METRICS,
  EURO_METRICS,
  METRIC_LABELS,
  PRIX_METRICS,
  type Metric,
  type ScoreFeature,
} from "@/lib/score"
import { adaptScoreProperties, useScoreMesh } from "@/hooks/useScoreMesh"
import { useChoropleth } from "@/hooks/useChoropleth"
import {
  BIVAR_CLASS_LABELS,
  makeBivariateScale,
  makeDivergingScale,
  makePriceScale,
  makeSequentialScale,
} from "@/lib/scoreColors"
import { Button } from "@/components/ui/button"
import { DeckOverlay } from "@/components/deck-overlay"
import { MapTopBar } from "@/components/map-top-bar"
import { useTheme } from "@/components/theme-provider"
import {
  BASEMAP_STYLES,
  isBasemap,
  syncBasemapStyle,
  themeBasemap,
  type Basemap,
} from "@/lib/basemaps"
import { ScoreSidebar, type MapView } from "@/components/score-sidebar"
import WordCloudPopup from "@/components/WordCloudPopup"
import { CommunePanel } from "@/components/commune-panel"
import { useAvisIndex } from "@/hooks/useAvis"
import type { AvisIndexEntry } from "@/lib/avis"

// Bbox d'une géométrie GeoJSON, pour cadrer une commune au deep-link.
// Parcourt récursivement les coordonnées (Polygon / MultiPolygon).
function geometryBounds(
  geom: ScoreFeature["geometry"],
): [[number, number], [number, number]] {
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
  return [
    [minX, minY],
    [maxX, maxY],
  ]
}

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 2.4,
  latitude: 46.6,
  zoom: 5,
}

// v=lat,lng,zoom — même convention que /carte (liens croisés entre cartes).
function parseViewParam(v: string | null): MapViewState | null {
  if (!v) return null
  const [lat, lng, zoom] = v.split(",").map(Number)
  if ([lat, lng, zoom].some((n) => !Number.isFinite(n))) return null
  return { latitude: lat, longitude: lng, zoom }
}

const isMetric = (v: string | null): v is Metric =>
  v != null && (METRICS as string[]).includes(v)

// Dézoom plafonné : au-delà on ne verrait plus que l'océan autour de la France.
const MIN_ZOOM = 4

// Identité stable pour deck.gl pendant le chargement (un littéral inline
// recréerait la couche à chaque render).
const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] }

// Ordre du sélecteur : score global, écart qualité/prix, prix par type de
// bien, puis les 12 dimensions.
const METRICS: Metric[] = ["score_valeur", "gap_pondere", ...PRIX_METRICS, ...DIMENSIONS]

/** Formate une valeur de métrique (gap signé, prix en €/m², reste en 0–1). */
function fmt(metric: Metric, v: number | null | undefined): string {
  if (v == null) return "—"
  if (metric === "gap_pondere") return (v >= 0 ? "+" : "") + v.toFixed(2)
  if (EURO_METRICS.has(metric)) return `${Math.round(v).toLocaleString("fr-FR")} €/m²`
  return v.toFixed(2)
}

export default function ScoreMap() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Vue initiale depuis l'URL (v=), figée au premier rendu.
  const [initialViewRef] = useState<MapViewState>(
    () => parseViewParam(new URLSearchParams(window.location.search).get("v")) ?? INITIAL_VIEW_STATE,
  )
  const [hovered, setHovered] = useState<ScoreFeature | null>(null)
  const [metric, setMetric] = useState<Metric>(() => {
    const m = searchParams.get("m")
    return isMetric(m) ? m : "score_valeur"
  })
  // Mode bivarié : croise `metric` (axe x) avec `metricY` (axe y) sur 3×3 classes.
  const [bivariate, setBivariate] = useState(() => isMetric(searchParams.get("y")))
  const [metricY, setMetricY] = useState<Metric>(() => {
    const y = searchParams.get("y")
    return isMetric(y) ? y : "n_prix"
  })
  const [opacity, setOpacity] = useState(0.8)
  // Fond de carte : `fond=` dans l'URL vaut choix explicite (il y reste) ;
  // sinon le fond suit le thème de l'app (clair/sombre), bascules comprises.
  const { resolvedTheme } = useTheme()
  const [basemapExplicit, setBasemapExplicit] = useState(() =>
    isBasemap(searchParams.get("fond"))
  )
  const [basemap, setBasemap] = useState<Basemap>(() => {
    const f = searchParams.get("fond")
    return isBasemap(f) ? f : themeBasemap(resolvedTheme)
  })
  const [fillBeforeId, setFillBeforeId] = useState<string | undefined>()
  const [wordCloudEnabled, setWordCloudEnabled] = useState(false)
  const [selectedCity, setSelectedCity] = useState<{ code: string; nom: string } | null>(
    null,
  )
  const mapRef = useRef<MapRef>(null)

  // Recentre la carte (France métro ou un DROM) via une animation flyTo.
  const centerOn = (view: MapView) =>
    mapRef.current?.flyTo({ center: view.center, zoom: view.zoom, duration: 1200 })

  // Vue courante au format v= (lien croisé vers /carte).
  const currentViewParam = () => {
    const map = mapRef.current
    if (!map) return ""
    const c = map.getCenter()
    return `${c.lat.toFixed(4)},${c.lng.toFixed(4)},${map.getZoom().toFixed(2)}`
  }

  // Maille adaptative : régions -> départements -> communes selon le zoom.
  const [zoom, setZoom] = useState(() => initialViewRef.zoom ?? 5)
  const { data, mesh, isLoading, isError } = useScoreMesh(zoom)

  // Marqueurs « avis » : index CDN (communes couvertes + centres), lazy.
  const { data: cities } = useAvisIndex(wordCloudEnabled)

  // Commune sélectionnée = source de vérité dans l'URL (?commune=<code>), pour un
  // deep-link partageable et rechargeable.
  const selectedCode = searchParams.get("commune")
  // La géométrie de la commune sélectionnée vient de la maille communale,
  // quelle que soit la maille affichée (deep-link ?commune= au zoom national).
  // Même queryKey que la maille communes : zéro fetch en double au zoom élevé.
  const { data: communesData } = useChoropleth("communes", "mid", !!selectedCode)
  const selected = useMemo(() => {
    if (!selectedCode) return null
    const feat = communesData?.features.find(
      (f) => f.properties.code_commune === selectedCode,
    )
    return feat
      ? ({
          type: "Feature" as const,
          geometry: feat.geometry,
          properties: adaptScoreProperties(feat.properties),
        } as ScoreFeature)
      : null
  }, [communesData, selectedCode])

  // Mises à jour FUSIONNANTES : chaque écrivain ne touche que sa clé (le
  // setSearchParams({commune}) historique écrasait métrique/fond, audit A3).
  const patchParams = (patch: Record<string, string | null>, replace = false) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v == null) next.delete(k)
          else next.set(k, v)
        }
        return next
      },
      { replace },
    )

  const selectCommune = (code: string) => patchParams({ commune: code })
  const closePanel = () => patchParams({ commune: null })

  // Métrique / bivarié / fond dans l'URL (replace : pas de spam d'historique).
  useEffect(() => {
    patchParams(
      {
        m: metric === "score_valeur" ? null : metric,
        y: bivariate ? metricY : null,
        fond: basemapExplicit ? basemap : null,
      },
      true,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, metricY, bivariate, basemap, basemapExplicit])

  // Échap ferme le panneau.
  useEffect(() => {
    if (!selectedCode) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePanel()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode])

  // Deep-link : dès que données ET carte sont prêtes, si l'URL cible une
  // commune, on la cadre. `mapReady` est indispensable : en navigation interne
  // les données sortent du cache immédiatement, avant que la carte n'existe.
  // Ne se redéclenche pas aux clics suivants (garde didDeepLinkCenter).
  const [mapReady, setMapReady] = useState(false)
  const didDeepLinkCenter = useRef(false)
  useEffect(() => {
    if (!data || !mapReady || didDeepLinkCenter.current) return
    didDeepLinkCenter.current = true
    if (selected) {
      // Cadre la commune avec une large marge : centré dessus, mais les
      // alentours restent bien visibles. maxZoom borne le zoom sur les
      // petites communes.
      // Même durée d'animation que le recentrage France métro / DROM.
      mapRef.current?.fitBounds(geometryBounds(selected.geometry), {
        padding: 100,
        maxZoom: 11,
        duration: 1200,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mapReady])

  const diverging = DIVERGING_METRICS.has(metric)

  // Échelle recalculée quand la métrique ou les données changent. Palette par
  // famille : YlOrRd pour les prix (identique à /carte), bleu-violet pour le
  // score et ses dimensions, PRGn divergent pour le gap.
  const scale = useMemo(() => {
    const values = (data?.features ?? []).map((f) => f.properties[metric])
    if (diverging) return makeDivergingScale(values)
    return EURO_METRICS.has(metric) ? makePriceScale(values) : makeSequentialScale(values)
  }, [data, metric, diverging])

  // Échelle bivariée (terciles sur chaque axe), seulement en mode bivarié.
  const bivarScale = useMemo(() => {
    if (!bivariate) return null
    const fs = data?.features ?? []
    return makeBivariateScale(
      fs.map((f) => f.properties[metric]),
      fs.map((f) => f.properties[metricY]),
    )
  }, [data, bivariate, metric, metricY])

  const layers = useMemo(() => {
    const choropleth = new GeoJsonLayer<ScoreFeature["properties"]>({
      id: `score-choropleth-${mesh}`,
      data: data ?? EMPTY_COLLECTION,
      // beforeId glisse la couche sous les labels (prop runtime de @deck.gl/mapbox,
      // non typée en v8) ; spread conditionnel pour éviter l'erreur de type.
      ...(fillBeforeId ? { beforeId: fillBeforeId } : {}),
      filled: true,
      stroked: true,
      opacity,
      getFillColor: (f) => {
        const p = (f as ScoreFeature).properties
        return bivarScale
          ? bivarScale.color(p[metric], p[metricY])
          : scale.color(p[metric])
      },
      getLineColor: [255, 255, 255, 120],
      lineWidthMinPixels: 0.5,
      pickable: true,
      onHover: (info) => setHovered((info.object as ScoreFeature) ?? null),
      onClick: (info) => {
        const feat = info.object as ScoreFeature | undefined
        if (!feat) return
        if (mesh === "communes" && feat.properties.code_commune) {
          selectCommune(feat.properties.code_commune)
          return
        }
        // Drill-down : cadre la région / le département cliqué.
        mapRef.current?.fitBounds(geometryBounds(feat.geometry), {
          padding: 40,
          duration: 800,
        })
      },
      // metric + scale doivent déclencher le recalcul des couleurs (sinon
      // deck.gl garde l'ancienne palette en cache).
      updateTriggers: { getFillColor: [scale, bivarScale, metric, metricY] },
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

    if (mesh !== "communes" || !wordCloudEnabled || !cities)
      return [choropleth, highlight]

    const wordCloudLayer = new ScatterplotLayer<AvisIndexEntry>({
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
      onClick: (info: PickingInfo) => {
        const entry = info.object as AvisIndexEntry | undefined
        setSelectedCity(entry ? { code: entry.c, nom: entry.n ?? entry.c } : null)
      },
    })
    return [choropleth, highlight, wordCloudLayer]
  }, [data, mesh, scale, bivarScale, metric, metricY, opacity, fillBeforeId, selected, wordCloudEnabled, cities])

  const hoveredValue = hovered?.properties[metric]
  // Classes bivariées de la commune survolée, pour la ligne « Classe » du tooltip.
  const hoveredClasses =
    hovered && bivarScale
      ? bivarScale.classes(hovered.properties[metric], hovered.properties[metricY])
      : null

  // À chaque (re)chargement de style — initial OU changement de fond — labels FR
  // + mémorisation du 1er calque de symboles (beforeId), cf. lib/basemaps.
  const syncMapStyle = (map: MaplibreMap) => setFillBeforeId(syncBasemapStyle(map))

  // Changement de fond : détacher le beforeId dans le même commit — l'ancien id
  // n'existe pas (encore) dans le style suivant, deck ré-ajouterait les couches
  // sous un calque fantôme ; le styledata du nouveau style le re-fournit.
  const changeBasemap = (b: Basemap) => {
    setFillBeforeId(undefined)
    setBasemapExplicit(true)
    setBasemap(b)
  }

  // Tant qu'aucun fond n'est choisi explicitement, suivre les bascules de
  // thème (même détachement du beforeId qu'un changement manuel).
  useEffect(() => {
    if (basemapExplicit) return
    setFillBeforeId(undefined)
    setBasemap(themeBasemap(resolvedTheme))
  }, [resolvedTheme, basemapExplicit])

  return (
    <div className="flex h-svh w-svw overflow-hidden bg-background text-foreground">
      <ScoreSidebar
        metrics={METRICS}
        metric={metric}
        onMetric={setMetric}
        scale={scale}
        bivarScale={bivarScale}
        format={(v) => fmt(metric, v)}
        formatY={(v) => fmt(metricY, v)}
        opacity={opacity}
        onOpacity={setOpacity}
        basemap={basemap}
        onBasemap={changeBasemap}
        onCenter={centerOn}
        bivariate={bivariate}
        onBivariate={setBivariate}
        metricY={metricY}
        onMetricY={setMetricY}
        isLoading={isLoading}
        isError={isError}
        wordCloudEnabled={wordCloudEnabled}
        onWordCloudEnabled={setWordCloudEnabled}
      />

      <div className="relative flex-1">
        <MapTopBar
          onSelectCommune={(entry) => selectCommune(entry.c)}
          extra={
            <Button variant="ghost" size="sm" asChild className="max-md:hidden">
              <Link
                to={`/carte?v=${currentViewParam()}${basemapExplicit ? `&fond=${basemap}` : ""}`}
              >
                Voir en prix
              </Link>
            </Button>
          }
        />
        <Map
          ref={mapRef}
          initialViewState={initialViewRef}
          minZoom={MIN_ZOOM}
          onMoveEnd={(e) => {
            const c = e.viewState
            setZoom(c.zoom)
            patchParams(
              { v: `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)},${c.zoom.toFixed(2)}` },
              true,
            )
          }}
          mapStyle={BASEMAP_STYLES[basemap]}
          // Rechargement complet au changement de fond (les styles Carto partagent
          // les mêmes ids ; le diff laisserait des libellés anglais résiduels).
          styleDiffing={false}
          onStyleData={(e) => syncMapStyle(e.target)}
          onLoad={() => setMapReady(true)}
          style={{ width: "100%", height: "100%" }}
        >
          <DeckOverlay layers={layers} />
        </Map>

        {/* Tooltip au survol */}
        {hovered && (
          <div className="absolute bottom-4 left-4 max-w-72 rounded-xl border bg-background/95 p-3 text-sm shadow-lg backdrop-blur pointer-coarse:hidden">
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
            {bivariate && (
              <div>
                {METRIC_LABELS[metricY]} :{" "}
                <span className="font-semibold text-accent">
                  {fmt(metricY, hovered.properties[metricY])}
                </span>
              </div>
            )}
            {hoveredClasses && (
              <div className="text-muted-foreground">
                Classe : {BIVAR_CLASS_LABELS[hoveredClasses[0]]} ×{" "}
                {BIVAR_CLASS_LABELS[hoveredClasses[1]]}
              </div>
            )}
            <div className="text-muted-foreground">
              {hovered.properties.prix != null
                ? `${Math.round(hovered.properties.prix).toLocaleString("fr-FR")} €/m²`
                : "prix —"}
            </div>
          </div>
        )}

        {selectedCity && (
          <WordCloudPopup
            code={selectedCity.code}
            nom={selectedCity.nom}
            onClose={() => setSelectedCity(null)}
          />
        )}
      </div>

      {/* Panneau de détail de la commune sélectionnée (clic) */}
      {selected && <CommunePanel feature={selected} onClose={closePanel} />}
    </div>
  )
}
