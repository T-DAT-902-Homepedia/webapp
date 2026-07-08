import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { EvolutionPoint } from "@/lib/commune"
import { formatEuroM2, formatInt } from "@/lib/format"

// Courbe d'évolution du prix au m² (millésimes DVF), multi-séries dès le
// départ (superposition A/B en comparaison), UN SEUL axe Y — jamais de double
// axe. `reference` accepte une série de contexte (médiane nationale), tracée
// en pointillés gris.

export interface EvolutionSerie {
  label: string
  points: EvolutionPoint[]
  colorVar: string
}

export function EvolutionChart({
  series,
  reference,
}: {
  series: EvolutionSerie[]
  reference?: EvolutionSerie
}) {
  const all = reference ? [...series, reference] : series
  const years = [...new Set(all.flatMap((s) => s.points.map((p) => p.annee)))].sort()
  const data = years.map((annee) => {
    const row: Record<string, number | null> = { annee }
    for (const s of all) {
      const point = s.points.find((p) => p.annee === annee)
      row[s.label] = point?.prix_m2_median ?? null
      row[`${s.label}__nb`] = point?.nb_transactions ?? null
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="annee"
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          tickFormatter={(v: number) => formatInt(v)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={52}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(value, name, item) => {
            const nb = item?.payload?.[`${name}__nb`] as number | null | undefined
            const prix = formatEuroM2(typeof value === "number" ? value : null)
            return nb != null ? `${prix} (${formatInt(nb)} ventes)` : prix
          }}
          labelFormatter={(annee) => `Millésime ${annee}`}
          contentStyle={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--foreground)",
          }}
        />
        {all.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Line
            key={s.label}
            dataKey={s.label}
            stroke={`var(${s.colorVar})`}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
        {reference && (
          <Line
            dataKey={reference.label}
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
