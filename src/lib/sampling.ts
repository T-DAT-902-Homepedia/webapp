// Échantillonnage stratifié pur (testé Vitest) pour le nuage de points
// prix × score : ~18k communes scorées ne tiennent pas dans un SVG fluide.

/**
 * Garde au plus `target` éléments en préservant la distribution : découpe
 * `items` (déjà ordonnables via `key`) en strates de taille égale et
 * sous-échantillonne chaque strate au même taux, à pas constant
 * (déterministe : pas de tirage aléatoire, stable entre renders).
 */
export function stratifiedSample<T>(
  items: T[],
  key: (item: T) => number,
  target: number,
): T[] {
  if (items.length <= target) return items
  const sorted = [...items].sort((a, b) => key(a) - key(b))
  const step = sorted.length / target
  const out: T[] = []
  for (let i = 0; i < target; i++) {
    out.push(sorted[Math.min(sorted.length - 1, Math.round(i * step))])
  }
  return out
}
