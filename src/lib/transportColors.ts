import type { RGBA } from "@/lib/colorScale"

const NO_DATA: RGBA = [200, 200, 200, 60]

// --- Choroplèthe : échelle séquentielle (vert) par quantiles -------------------

export const TRANSPORT_PALETTE: RGBA[] = [
  [237, 248, 233, 255],
  [199, 233, 192, 255],
  [161, 217, 155, 255],
  [116, 196, 118, 255],
  [49, 163, 84, 255],
  [0, 109, 44, 255],
]

/** Échelle quantile sur la densité (stations/km²).
 *
 * Prend les valeurs brutes (géométrie et valeurs sont séparées) et renvoie une
 * fonction couleur indexée par valeur. Les seuils sont calculés sur les valeurs
 * STRICTEMENT POSITIVES uniquement : ~40 % des communes sont à 0 (aucun
 * transport) et tasseraient sinon la moitié du dégradé sur zéro. Les zéros
 * tombent dans la classe la plus claire ; quantiles rang-based -> robustes aux
 * micro-communes à densité aberrante (aire minuscule).
 */
export function makeTransportScale(values: (number | null | undefined)[]) {
  const sorted = values
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b)

  const thresholds: number[] = []
  if (sorted.length > 1) {
    for (let i = 1; i < TRANSPORT_PALETTE.length; i++) {
      const q = i / TRANSPORT_PALETTE.length
      thresholds.push(sorted[Math.floor(q * (sorted.length - 1))])
    }
  }

  return function color(v: number | null | undefined): RGBA {
    if (v == null) return NO_DATA
    let cls = 0
    while (cls < thresholds.length && v > thresholds[cls]) cls++
    return TRANSPORT_PALETTE[cls]
  }
}

// --- Points d'arrêts : couleur par mode de transport ---------------------------

export const ROUTE_TYPE_COLORS: Record<string, RGBA> = {
  bus: [58, 105, 200, 230],
  tramway: [227, 66, 82, 230],
  "métro": [240, 185, 60, 230],
  train: [62, 160, 85, 230],
  autres: [140, 140, 140, 230],
}

export function routeTypeColor(routeType: string | null | undefined): RGBA {
  return (routeType && ROUTE_TYPE_COLORS[routeType]) || [140, 140, 140, 230]
}
