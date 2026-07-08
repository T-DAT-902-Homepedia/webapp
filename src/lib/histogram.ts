// Binning pur pour les histogrammes de prix (fonctions testables sans DOM).

export interface HistogramBin {
  /** Borne basse incluse. */
  from: number
  /** Borne haute exclue (dernier bin : incluse). */
  to: number
  count: number
}

/**
 * Histogramme à bins uniformes sur [0, hi] où hi = quantile `clip` arrondi à
 * la centaine (mêmes conventions que charts/prix_distribution.json côté
 * pipeline). Les valeurs au-delà de hi sont écartées, pas accumulées dans le
 * dernier bin : la traîne fausserait la lecture.
 */
export function buildHistogram(
  values: (number | null | undefined)[],
  bins = 30,
  clip = 0.99,
): HistogramBin[] {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (nums.length === 0) return []
  const sorted = [...nums].sort((a, b) => a - b)
  // Rang le plus proche sur n-1 : le dernier centile est bien écarté (un
  // index sur n inclurait le max lui-même dès n >= 100).
  const q = sorted[Math.floor(clip * (sorted.length - 1))]
  const hi = Math.max(100, Math.round(q / 100) * 100)
  const width = hi / bins

  const counts = new Array<number>(bins).fill(0)
  for (const v of nums) {
    if (v > hi) continue
    counts[Math.min(bins - 1, Math.floor(v / width))]++
  }
  return counts.map((count, i) => ({
    from: Math.round(i * width),
    to: Math.round((i + 1) * width),
    count,
  }))
}

/** Index du bin contenant `value` (null si hors domaine). */
export function binIndexOf(bins: HistogramBin[], value: number | null | undefined): number | null {
  if (value == null || bins.length === 0) return null
  const last = bins[bins.length - 1]
  if (value < 0 || value > last.to) return null
  const i = bins.findIndex((b, j) => value >= b.from && (value < b.to || j === bins.length - 1))
  return i === -1 ? null : i
}
