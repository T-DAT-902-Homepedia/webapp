import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import type { Composantes } from "@/lib/commune"
import { COMPOSANTES_PONDEREES } from "@/lib/score"
import { formatScore } from "@/lib/format"

// Radar Recharts des 9 dimensions PONDÉRÉES du score (ordonnées par poids,
// domaine fixe 0-1), multi-séries dès le départ : la page comparaison superpose
// deux communes sans réécrire le composant. Distinct du radar « 5 sources »
// du panneau carte (components/score-radar.tsx), qui garde sa vocation compacte.

export interface RadarSerie {
  label: string
  composantes: Composantes
  /** Token thème (--chart-1 bleu pour A, --chart-3 orange pour B). */
  colorVar: string
}

export function ScoreRadar({ series }: { series: RadarSerie[] }) {
  const data = COMPOSANTES_PONDEREES.map((c) => {
    const row: Record<string, string | number> = {
      dimension: c.label,
      // Poids affiché dans le tooltip pour rappeler l'anatomie du score.
      poids: c.poids ?? 0,
    }
    for (const s of series) row[s.label] = s.composantes[c.key] ?? 0
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
        <Tooltip
          formatter={(value) => formatScore(typeof value === "number" ? value : null)}
          contentStyle={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--foreground)",
          }}
        />
        {series.map((s) => (
          <Radar
            key={s.label}
            name={s.label}
            dataKey={s.label}
            stroke={`var(${s.colorVar})`}
            fill={`var(${s.colorVar})`}
            fillOpacity={series.length > 1 ? 0.12 : 0.2}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  )
}
