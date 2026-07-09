// Source UNIQUE des fonds de carte : /map et /carte proposent les mêmes fonds
// avec les mêmes clés (le paramètre d'URL `fond=` circule entre les deux pages
// via les liens croisés).
//
// - Vecteur Carto (schéma OpenMapTiles) : clair (Positron), sombre (Dark
//   Matter), couleur (Voyager) — labels repassés en FR par syncBasemapStyle.
// - Satellite : imagerie aérienne Esri (raster, sans clé ni labels).

import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl"

export type Basemap = "clair" | "sombre" | "satellite" | "couleur"

export const BASEMAP_LABELS: Record<Basemap, string> = {
  clair: "Clair",
  sombre: "Sombre",
  satellite: "Satellite",
  couleur: "Couleur",
}

export const BASEMAP_KEYS = Object.keys(BASEMAP_LABELS) as Basemap[]

export const isBasemap = (v: string | null): v is Basemap =>
  v != null && v in BASEMAP_LABELS

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

export const BASEMAP_STYLES: Record<Basemap, string | StyleSpecification> = {
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

/** À appeler sur chaque styledata — chargement initial OU changement de fond :
 *  repasse les labels en français et renvoie l'id du 1er calque de symboles
 *  (le beforeId sous lequel glisser les couches deck pour garder les labels
 *  au-dessus). Le satellite (raster, sans symbole) court-circuite : pas de FR,
 *  renvoie undefined (couches au-dessus du fond). */
export function syncBasemapStyle(map: MaplibreMap): string | undefined {
  const styleLayers = map.getStyle()?.layers ?? []
  const symbols = styleLayers.filter((l) => l.type === "symbol")
  if (symbols.length === 0) return undefined
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
  return symbols[0]?.id
}
