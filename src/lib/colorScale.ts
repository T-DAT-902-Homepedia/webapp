import type { ChoroplethFeature, ChoroplethProperties } from "@/lib/choropleth"

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
 * Échelle de couleur par quantiles générique : classe une valeur numérique dans
 * la palette selon des seuils rang-based calculés sur les valeurs non nulles.
 * Réutilisée par le DVF (prix) et le score (dimensions) — cf. scoreColors.ts.
 *
 * Bornes de quantiles (n-1 seuils pour n classes). Avec moins de 2 valeurs
 * distinctes, `thresholds` reste vide (tout tombe dans la 1re classe).
 */
export function quantileScale(
  values: (number | null | undefined)[],
  palette: RGBA[],
  noData: RGBA = NO_DATA,
) {
  const sorted = values
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)

  const thresholds: number[] = []
  if (sorted.length > 1) {
    for (let i = 1; i < palette.length; i++) {
      thresholds.push(sorted[Math.floor((i / palette.length) * (sorted.length - 1))])
    }
  }

  return function color(v: number | null | undefined): RGBA {
    if (v == null) return noData
    let cls = 0
    while (cls < thresholds.length && v > thresholds[cls]) cls++
    return palette[cls]
  }
}

/**
 * Échelle DVF : quantiles sur la valeur du type de local courant. L'atténuation
 * « faible volume » utilise le `fiable` du même type (maison_/appart_).
 * La paramétrisation complète par métrique arrive en PR2.
 */
export function makeColorScale(
  features: ChoroplethFeature[],
  getValue: (p: ChoroplethProperties) => number | null,
  getFiable: (p: ChoroplethProperties) => boolean,
): (f: ChoroplethFeature) => RGBA {
  const base = quantileScale(
    features.map((f) => getValue(f.properties)),
    PALETTE,
  )
  return function color(feature: ChoroplethFeature): RGBA {
    const v = getValue(feature.properties)
    if (v == null) return NO_DATA
    const rgba = base(v)
    return getFiable(feature.properties) ? rgba : [rgba[0], rgba[1], rgba[2], 110]
  }
}
