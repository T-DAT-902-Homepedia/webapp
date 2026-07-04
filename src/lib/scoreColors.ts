import { quantileScale, type RGBA } from "@/lib/colorScale"

const NO_DATA: RGBA = [200, 200, 200, 60]

// --- Séquentiel (score global + dimensions, valeurs dans [0, 1]) ---------------

// Palette séquentielle bleu-vert (viridis-like tronquée) : lisible sur fonds clair
// et sombre, distincte du DVF (jaune-rouge) et du transport (vert).
const SEQ_PALETTE: RGBA[] = [
  [237, 248, 251, 255],
  [191, 211, 230, 255],
  [158, 188, 218, 255],
  [140, 150, 198, 255],
  [136, 86, 167, 255],
  [129, 15, 124, 255],
]

/** Échelle séquentielle par quantiles sur des valeurs 0–1 (score, dimensions).
 *
 * Quantiles rang-based (robustes aux distributions resserrées des dimensions
 * normalisées) via le helper partagé `quantileScale`. Les NULL -> gris "no data".
 */
export function makeSequentialScale(values: (number | null | undefined)[]) {
  return quantileScale(values, SEQ_PALETTE, NO_DATA)
}

// --- Divergent (gap_pondere, centré sur 0) -------------------------------------

// Rouge (négatif = cher pour ce qu'offre la commune) -> blanc (neutre) ->
// bleu (positif = bon rapport qualité/prix). Symétrique autour de 0.
const NEG: RGBA = [202, 0, 32, 255] // gap très négatif
const MID: RGBA = [247, 247, 247, 255] // ~0
const POS: RGBA = [5, 113, 176, 255] // gap très positif

function lerp(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ]
}

/** Échelle divergente centrée sur 0. L'amplitude est bornée au quantile 95 des
 *  |valeurs| pour que quelques extrêmes n'aplatissent pas tout le dégradé. */
export function makeDivergingScale(values: (number | null | undefined)[]) {
  const mags = values
    .filter((v): v is number => v != null)
    .map(Math.abs)
    .sort((a, b) => a - b)
  const bound = mags.length ? mags[Math.floor(0.95 * (mags.length - 1))] || 1 : 1

  return function color(v: number | null | undefined): RGBA {
    if (v == null) return NO_DATA
    const t = Math.max(-1, Math.min(1, v / bound)) // [-1, 1]
    return t < 0 ? lerp(MID, NEG, -t) : lerp(MID, POS, t)
  }
}

// Rampe pour la légende (échantillon régulier de la palette séquentielle).
export const SEQ_LEGEND = SEQ_PALETTE
// Rampe divergente pour la légende (NEG -> MID -> POS).
export const DIV_LEGEND: RGBA[] = [NEG, lerp(MID, NEG, 0.5), MID, lerp(MID, POS, 0.5), POS]

// --- Bivarié (croisement de 2 métriques, 3×3) -----------------------------------

// Palette bivariée 3×3 « bleu-violet » (Joshua Stevens) : BIVAR_PALETTE[y][x],
// x = classe de la 1re métrique (colonnes), y = classe de la 2e (lignes),
// classe 0 = faible. Le coin [2][2] (élevé × élevé) est le plus saturé.
export const BIVAR_PALETTE: RGBA[][] = [
  [[232, 232, 232, 255], [172, 228, 228, 255], [90, 200, 200, 255]],
  [[223, 176, 214, 255], [165, 173, 211, 255], [86, 152, 185, 255]],
  [[190, 100, 172, 255], [140, 98, 170, 255], [59, 73, 148, 255]],
]

export const BIVAR_CLASS_LABELS = ["faible", "moyen", "élevé"] as const

// Seuils de terciles rang-based (même approche que quantileScale, mais ici on a
// besoin de l'indice de classe pour le tooltip, pas seulement de la couleur).
function tercileThresholds(values: (number | null | undefined)[]): number[] {
  const sorted = values.filter((v): v is number => v != null).sort((a, b) => a - b)
  if (sorted.length < 2) return []
  return [1, 2].map((i) => sorted[Math.floor((i / 3) * (sorted.length - 1))])
}

function classOf(thresholds: number[], v: number): number {
  let c = 0
  while (c < thresholds.length && v > thresholds[c]) c++
  return c
}

/** Échelle bivariée 3×3 par terciles : couleur + classes (pour le tooltip).
 *  Une valeur manquante sur l'un des deux axes -> gris « no data ». */
export function makeBivariateScale(
  xs: (number | null | undefined)[],
  ys: (number | null | undefined)[],
) {
  const tx = tercileThresholds(xs)
  const ty = tercileThresholds(ys)
  return {
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
