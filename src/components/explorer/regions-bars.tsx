import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { fetchRegionStats, type RegionStats } from "@/lib/regions"
import { useMeta } from "@/hooks/useMeta"
import { formatEuroM2, formatInt, formatScore, formatSigned } from "@/lib/format"
import { cn } from "@/lib/utils"

// Palmarès des régions : barres horizontales triées par la métrique choisie
// + tableau complet (l'exigence « analyse au niveau région » du sujet, volet
// tabulaire). Données stats/regions.json (choroplèthe régionale sans géométrie).

type RegionMetric = "prix" | "maison" | "appartement" | "score" | "gap"

const METRIC_DEFS: Record<
  RegionMetric,
  { label: string; value: (r: RegionStats) => number | null; format: (v: number | null) => string }
> = {
  prix: { label: "Prix médian", value: (r) => r.prix_m2_median, format: formatEuroM2 },
  maison: { label: "Prix maison", value: (r) => r.maison_prix_m2_median, format: formatEuroM2 },
  appartement: {
    label: "Prix appartement",
    value: (r) => r.appart_prix_m2_median,
    format: formatEuroM2,
  },
  score: { label: "Score médian", value: (r) => r.score_median, format: formatScore },
  gap: {
    label: "Écart qualité/prix",
    value: (r) => r.gap_pondere_median,
    format: formatSigned,
  },
}

export function RegionsPanel() {
  const { data: meta } = useMeta()
  const [metric, setMetric] = useState<RegionMetric>("prix")

  const { data: regions } = useQuery({
    queryKey: ["regions-stats", meta?.base],
    queryFn: () => fetchRegionStats(meta!.base),
    enabled: !!meta,
    staleTime: Infinity,
  })

  const def = METRIC_DEFS[metric]
  const sorted = useMemo(
    () =>
      regions
        ? [...regions].sort((a, b) => (def.value(b) ?? -Infinity) - (def.value(a) ?? -Infinity))
        : [],
    [regions, def],
  )

  if (regions === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Les agrégats régionaux ne sont pas encore publiés pour ce run de données.
      </p>
    )
  }
  if (!regions) {
    return <p className="text-sm text-muted-foreground">Chargement des régions…</p>
  }

  const chartData = sorted.map((r) => ({
    nom: r.nom,
    code: r.code_region,
    valeur: def.value(r),
  }))

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        {(Object.keys(METRIC_DEFS) as RegionMetric[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={cn(
              "rounded-md border px-2 py-1 transition-colors",
              metric === m
                ? "border-accent bg-accent/10 font-semibold text-accent"
                : "border-input text-muted-foreground hover:bg-muted",
            )}
          >
            {METRIC_DEFS[m].label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={18 * 26 + 20}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 48, bottom: 0, left: 8 }}
        >
          <XAxis type="number" hide domain={metric === "gap" ? ["auto", "auto"] : [0, "auto"]} />
          <YAxis
            type="category"
            dataKey="nom"
            width={190}
            tick={{ fill: "var(--foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => [def.format(typeof value === "number" ? value : null), def.label]}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--foreground)",
            }}
          />
          <Bar dataKey="valeur" radius={[0, 3, 3, 0]} maxBarSize={16}>
            {chartData.map((d) => (
              <Cell
                key={d.code}
                fill={
                  metric === "gap"
                    ? (d.valeur ?? 0) >= 0
                      ? "#1b7837"
                      : "#762a83"
                    : "var(--chart-1)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-3 py-2 font-semibold text-muted-foreground">Région</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">€/m²</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Maison</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Appart.</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Ventes</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Score</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Écart</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.code_region} className="border-b last:border-b-0 hover:bg-muted/40">
                <td className="px-3 py-2 font-medium">{r.nom}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatEuroM2(r.prix_m2_median)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatEuroM2(r.maison_prix_m2_median)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatEuroM2(r.appart_prix_m2_median)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatInt(r.nb_transactions)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatScore(r.score_median)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-semibold tabular-nums",
                    (r.gap_pondere_median ?? 0) >= 0 ? "text-accent" : "text-destructive",
                  )}
                >
                  {formatSigned(r.gap_pondere_median)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
