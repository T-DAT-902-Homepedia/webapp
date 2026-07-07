import { useEffect, useMemo, useState } from "react"
import cloud from "d3-cloud"

import { SENTIMENT_COLORS, type AvisWord } from "@/lib/avis"

// Nuage de mots des avis : taille = fréquence pondérée (weight), couleur =
// sentiment dominant du mot (sémantique PRGn du gap). Layout d3-cloud rendu
// en SVG ; random figé pour un rendu stable entre renders.

interface PlacedWord {
  text: string
  size: number
  x: number
  y: number
  rotate: number
  sentiment: string
  weight: number
}

const WIDTH = 560
const HEIGHT = 300
const MAX_WORDS = 80

export function WordCloud({
  words,
  activeTheme,
  onWordClick,
}: {
  words: AvisWord[]
  /** Filtre : ne garder que les mots portant ce thème (null = tous). */
  activeTheme: string | null
  onWordClick?: (word: string) => void
}) {
  const filtered = useMemo(() => {
    const pool = activeTheme
      ? words.filter((w) => w.themes?.includes(activeTheme))
      : words
    return [...pool].sort((a, b) => b.weight - a.weight).slice(0, MAX_WORDS)
  }, [words, activeTheme])

  // Rempli par le callback "end" du layout (asynchrone, piloté par timer côté
  // d3-cloud) ; quand le filtre vide la liste, le rendu court-circuite sans
  // toucher à cet état.
  const [placed, setPlaced] = useState<PlacedWord[]>([])

  useEffect(() => {
    if (filtered.length === 0) return
    const max = Math.max(...filtered.map((w) => w.weight))
    // Échelle racine : les poids suivent une loi très asymétrique, le sqrt
    // évite qu'un seul mot écrase tout le nuage.
    const size = (w: number) => 12 + 34 * Math.sqrt(w / max)
    const layout = cloud<{ text: string; size: number; sentiment: string; weight: number }>()
      .size([WIDTH, HEIGHT])
      .words(
        filtered.map((w) => ({
          text: w.word,
          size: size(w.weight),
          sentiment: w.sentiment,
          weight: w.weight,
        })),
      )
      .padding(2)
      .rotate(0)
      .font("DM Sans Variable, sans-serif")
      .fontSize((d) => d.size ?? 12)
      .random(() => 0.5) // déterministe : pas de re-mélange à chaque render
      .on("end", (out) => setPlaced(out as PlacedWord[]))
    layout.start()
    return () => {
      layout.stop()
    }
  }, [filtered])

  if (filtered.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aucun mot pour ce thème.
      </p>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Nuage de mots des avis d'habitants"
    >
      <g transform={`translate(${WIDTH / 2},${HEIGHT / 2})`}>
        {placed.map((w) => (
          <text
            key={w.text}
            x={w.x}
            y={w.y}
            fontSize={w.size}
            fontFamily="DM Sans Variable, sans-serif"
            fontWeight={600}
            textAnchor="middle"
            fill={SENTIMENT_COLORS[w.sentiment] ?? SENTIMENT_COLORS.neutral}
            className={onWordClick ? "cursor-pointer hover:opacity-70" : undefined}
            onClick={() => onWordClick?.(w.text)}
          >
            <title>
              {w.text} — {w.weight} occurrences ({w.sentiment})
            </title>
            {w.text}
          </text>
        ))}
      </g>
    </svg>
  )
}
