// Centres des features choroplèthe pour la représentation en bulles.
// Centre de bbox : déterministe, O(n points), largement suffisant pour poser
// une bulle par commune/département (un vrai centroïde surfacique n'apporte
// rien à cette échelle).

import type { ChoroplethFeature } from "@/lib/choropleth"

export type Bbox = [minLng: number, minLat: number, maxLng: number, maxLat: number]

export function featureBbox(f: { geometry: unknown }): Bbox | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
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
  const geom = f.geometry as { coordinates?: unknown } | null
  if (!geom?.coordinates) return null
  visit(geom.coordinates)
  if (!Number.isFinite(minX)) return null
  return [minX, minY, maxX, maxY]
}

export function bboxIntersects(a: Bbox, b: Bbox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

/** Bbox par code département (depuis la choroplèthe départementale low,
 *  déjà en cache après la vue initiale). */
export function deptBboxes(features: ChoroplethFeature[]): Map<string, Bbox> {
  const out = new Map<string, Bbox>()
  for (const f of features) {
    const code = f.properties.code_departement
    if (!code) continue
    const bbox = featureBbox(f)
    if (bbox) out.set(code, bbox)
  }
  return out
}

export interface FeatureCentroid {
  position: [number, number]
  feature: ChoroplethFeature
}

export function featureCentroids(features: ChoroplethFeature[]): FeatureCentroid[] {
  const out: FeatureCentroid[] = []
  for (const f of features) {
    const bbox = featureBbox(f)
    if (!bbox) continue
    out.push({
      position: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
      feature: f,
    })
  }
  return out
}
