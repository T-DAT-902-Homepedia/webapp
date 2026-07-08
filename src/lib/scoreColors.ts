import { quantileScale, quantileThresholds } from "@/lib/colorScale"
import {
  BIVAR_3X3,
  GAP_MID,
  GAP_NEG,
  GAP_POS,
  NO_DATA,
  PRICE_SEQ,
  SCORE_SEQ,
  type RGBA,
} from "@/lib/palettes"

// Échelles de la carte /map. Les palettes vivent dans lib/palettes.ts (source
// unique inter-pages) ; ici seulement la mécanique quantiles/divergent/bivarié.

export interface SequentialScale {
  kind: "sequential"
  color(v: number | null | undefined): RGBA
  /** Bornes de classes (légende chiffrée), croissantes. */
  thresholds: number[]
  palette: RGBA[]
}

/** Échelle séquentielle par quantiles. Palette par défaut : score (bleu-violet) ;
 *  passer PRICE_SEQ pour les métriques en €/m² (YlOrRd, comme /carte). */
export function makeSequentialScale(
  values: (number | null | undefined)[],
  palette: RGBA[] = SCORE_SEQ,
): SequentialScale {
  return {
    kind: "sequential",
    color: quantileScale(values, palette, NO_DATA),
    thresholds: quantileThresholds(values, palette.length),
    palette,
  }
}

/** Échelle prix : mêmes quantiles, palette YlOrRd partagée avec /carte. */
export const makePriceScale = (values: (number | null | undefined)[]) =>
  makeSequentialScale(values, PRICE_SEQ)

// --- Divergent (gap_pondere, centré sur 0, PRGn) --------------------------------

function lerp(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ]
}

export interface DivergingScale {
  kind: "diverging"
  color(v: number | null | undefined): RGBA
  /** Amplitude robuste : le dégradé couvre [-bound, +bound]. */
  bound: number
}

/** Échelle divergente PRGn centrée sur 0 (violet = surcoté, vert = sous-coté).
 *  L'amplitude est bornée au quantile 95 des |valeurs| pour que quelques
 *  extrêmes n'aplatissent pas tout le dégradé — exposée pour la légende. */
export function makeDivergingScale(
  values: (number | null | undefined)[],
): DivergingScale {
  const mags = values
    .filter((v): v is number => v != null)
    .map(Math.abs)
    .sort((a, b) => a - b)
  const bound = mags.length ? mags[Math.floor(0.95 * (mags.length - 1))] || 1 : 1

  return {
    kind: "diverging",
    bound,
    color(v: number | null | undefined): RGBA {
      if (v == null) return NO_DATA
      const t = Math.max(-1, Math.min(1, v / bound)) // [-1, 1]
      return t < 0 ? lerp(GAP_MID, GAP_NEG, -t) : lerp(GAP_MID, GAP_POS, t)
    },
  }
}

export type MetricScale = SequentialScale | DivergingScale

// Rampe divergente pour la légende (NEG -> MID -> POS).
export const DIV_LEGEND: RGBA[] = [
  GAP_NEG,
  lerp(GAP_MID, GAP_NEG, 0.5),
  GAP_MID,
  lerp(GAP_MID, GAP_POS, 0.5),
  GAP_POS,
]

// --- Bivarié (croisement de 2 métriques, 3×3) -----------------------------------

export const BIVAR_PALETTE = BIVAR_3X3

export const BIVAR_CLASS_LABELS = ["faible", "moyen", "élevé"] as const

// Seuils de terciles rang-based (même approche que quantileThresholds, mais on
// a besoin de l'indice de classe pour le tooltip, pas seulement de la couleur).
function tercileThresholds(values: (number | null | undefined)[]): number[] {
  return quantileThresholds(values, 3)
}

function classOf(thresholds: number[], v: number): number {
  let c = 0
  while (c < thresholds.length && v > thresholds[c]) c++
  return c
}

/** Échelle bivariée 3×3 par terciles : couleur + classes (tooltip) + seuils
 *  (légende chiffrée). Une valeur manquante sur l'un des deux axes -> gris. */
export function makeBivariateScale(
  xs: (number | null | undefined)[],
  ys: (number | null | undefined)[],
) {
  const tx = tercileThresholds(xs)
  const ty = tercileThresholds(ys)
  return {
    /** Seuils de terciles de chaque axe (pour la légende). */
    tx,
    ty,
    /** Classes [x, y] dans {0,1,2}, ou null si l'une des valeurs manque. */
    classes(
      x: number | null | undefined,
      y: number | null | undefined,
    ): [number, number] | null {
      if (x == null || y == null) return null
      return [classOf(tx, x), classOf(ty, y)]
    },
    color(x: number | null | undefined, y: number | null | undefined): RGBA {
      const c = this.classes(x, y)
      return c ? BIVAR_PALETTE[c[1]][c[0]] : NO_DATA
    },
  }
}
