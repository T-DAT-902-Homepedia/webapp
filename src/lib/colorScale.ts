import type { ChoroplethFeature, ChoroplethProperties } from "@/lib/choropleth"
import { NO_DATA, PRICE_SEQ, type RGBA } from "@/lib/palettes"

export type { RGBA }

/** Seuils de quantiles rang-based : n-1 bornes pour n classes. Avec moins de
 *  2 valeurs distinctes, la liste reste vide (tout tombe dans la 1re classe).
 *  Exportés pour que les légendes affichent les mêmes bornes que la carte. */
export function quantileThresholds(
  values: (number | null | undefined)[],
  nClasses: number,
): number[] {
  const sorted = values
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)
  const thresholds: number[] = []
  if (sorted.length > 1) {
    for (let i = 1; i < nClasses; i++) {
      thresholds.push(sorted[Math.floor((i / nClasses) * (sorted.length - 1))])
    }
  }
  return thresholds
}

/**
 * Échelle de couleur par quantiles générique : classe une valeur numérique dans
 * la palette selon des seuils rang-based calculés sur les valeurs non nulles.
 * Réutilisée par le DVF (prix) et le score (dimensions) — cf. scoreColors.ts.
 */
export function quantileScale(
  values: (number | null | undefined)[],
  palette: RGBA[],
  noData: RGBA = NO_DATA,
) {
  const thresholds = quantileThresholds(values, palette.length)

  return function color(v: number | null | undefined): RGBA {
    if (v == null) return noData
    let cls = 0
    while (cls < thresholds.length && v > thresholds[cls]) cls++
    return palette[cls]
  }
}

export interface FeatureColorScale {
  getColor(f: ChoroplethFeature): RGBA
  /** Bornes de classes (pour la légende), croissantes. */
  thresholds: number[]
  palette: RGBA[]
}

/**
 * Échelle DVF : quantiles YlOrRd sur la valeur du type de local courant.
 * L'atténuation « faible volume » utilise le `fiable` du même type
 * (maison_/appart_). Les seuils sont exposés pour la légende de la carte.
 */
export function makeColorScale(
  features: ChoroplethFeature[],
  getValue: (p: ChoroplethProperties) => number | null,
  getFiable: (p: ChoroplethProperties) => boolean,
): FeatureColorScale {
  const values = features.map((f) => getValue(f.properties))
  const thresholds = quantileThresholds(values, PRICE_SEQ.length)
  const base = quantileScale(values, PRICE_SEQ)
  return {
    thresholds,
    palette: PRICE_SEQ,
    getColor(feature: ChoroplethFeature): RGBA {
      const v = getValue(feature.properties)
      if (v == null) return NO_DATA
      const rgba = base(v)
      return getFiable(feature.properties) ? rgba : [rgba[0], rgba[1], rgba[2], 110]
    },
  }
}
