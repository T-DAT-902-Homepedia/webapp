import type { RGBA } from "@/lib/colorScale"
import type { TransportFeature } from "@/lib/civic"

// --- Politique : couleurs catégorielles par famille d'orientation -------------
// Conventions FR usuelles (gauche rouge/rose, écolos vert, centre jaune-or,
// droite bleu, extrême droite bleu nuit), neutres pour le reste.

export const ORIENTATION_COLORS: Record<string, RGBA> = {
  gauche: [227, 66, 82, 255],
  ecologiste: [62, 160, 85, 255],
  centre: [240, 185, 60, 255],
  droite: [58, 105, 200, 255],
  extreme_droite: [32, 43, 88, 255],
  divers: [160, 120, 190, 255],
  sans_etiquette: [180, 180, 180, 200],
  inconnu: [120, 120, 120, 120],
}

export const ORIENTATION_LABELS: Record<string, string> = {
  gauche: "Gauche",
  ecologiste: "Écologiste",
  centre: "Centre",
  droite: "Droite",
  extreme_droite: "Extrême droite",
  divers: "Divers",
  sans_etiquette: "Sans étiquette",
  inconnu: "Inconnu",
}

const NO_DATA: RGBA = [200, 200, 200, 60]

export function orientationColor(orientation: string | undefined): RGBA {
  return (orientation && ORIENTATION_COLORS[orientation]) || NO_DATA
}

// --- Transport : échelle séquentielle (vert) par quantiles ---------------------

const TRANSPORT_PALETTE: RGBA[] = [
  [237, 248, 233, 255],
  [199, 233, 192, 255],
  [161, 217, 155, 255],
  [116, 196, 118, 255],
  [49, 163, 84, 255],
  [0, 109, 44, 255],
]

/** Échelle quantile sur stations_per_1000hab (même logique que le prix/m² DVF). */
export function makeTransportScale(features: TransportFeature[]) {
  const values = features
    .map((f) => f.properties.stations_per_1000hab)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)

  const thresholds: number[] = []
  if (values.length > 1) {
    for (let i = 1; i < TRANSPORT_PALETTE.length; i++) {
      const q = i / TRANSPORT_PALETTE.length
      thresholds.push(values[Math.floor(q * (values.length - 1))])
    }
  }

  return function color(feature: TransportFeature): RGBA {
    const v = feature.properties.stations_per_1000hab
    if (v == null) return NO_DATA
    let cls = 0
    while (cls < thresholds.length && v > thresholds[cls]) cls++
    return TRANSPORT_PALETTE[cls]
  }
}

// Couleur des points d'arrêts par type de transport.
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
