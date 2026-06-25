import type { ChoroplethFeature } from "@/lib/dvf"

export type RGBA = [number, number, number, number]

// Palette séquentielle (jaune -> rouge foncé), type "YlOrRd" simplifiée.
const PALETTE: RGBA[] = [
  [255, 255, 178, 255],
  [254, 217, 118, 255],
  [254, 178, 76, 255],
  [253, 141, 60, 255],
  [240, 59, 32, 255],
  [189, 0, 38, 255],
]

const NO_DATA: RGBA = [200, 200, 200, 60]

/**
 * Construit une échelle de couleur par quantiles sur le prix/m² médian des
 * features fournies. Les seuils s'adaptent aux données affichées (la maille
 * département et la maille commune n'ont pas la même dynamique).
 */
export function makeColorScale(features: ChoroplethFeature[]) {
  const values = features
    .map((f) => f.properties.prix_m2_median)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)

  // Bornes de quantiles (n-1 seuils pour n classes). Avec moins de 2 valeurs
  // distinctes, les quantiles n'ont pas de sens : on laisse `thresholds` vide
  // (toutes les features tombent alors dans la 1re classe).
  const thresholds: number[] = []
  if (values.length > 1) {
    for (let i = 1; i < PALETTE.length; i++) {
      const q = i / PALETTE.length
      thresholds.push(values[Math.floor(q * (values.length - 1))])
    }
  }

  return function color(feature: ChoroplethFeature): RGBA {
    const v = feature.properties.prix_m2_median
    if (v == null) return NO_DATA
    let cls = 0
    while (cls < thresholds.length && v > thresholds[cls]) cls++
    const rgba = PALETTE[cls]
    // Communes peu fiables (faible volume) : atténuées visuellement.
    return feature.properties.fiable ? rgba : [rgba[0], rgba[1], rgba[2], 110]
  }
}
