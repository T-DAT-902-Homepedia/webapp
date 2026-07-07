import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { fetchPrixDistribution } from "@/lib/charts"
import type { Fiche } from "@/lib/commune"
import { binIndexOf, buildHistogram, type HistogramBin } from "@/lib/histogram"
import { formatEuroM2, formatInt } from "@/lib/format"
import { useMeta } from "@/hooks/useMeta"
import { cn } from "@/lib/utils"

// « Où se situe cette commune ? » : histogramme de la distribution des prix,
// à l'échelle du département (médianes communales des fiches, déjà en cache
// via useFichesDept) ou de la France (charts/prix_distribution.json,
// transactions pré-binnées par le pipeline). Le bin de la commune est
// surligné + ReferenceLine sur sa médiane.

type Echelle = "departement" | "france"

function toBins(edges: number[], counts: number[]): HistogramBin[] {
  return counts.map((count, i) => ({ from: edges[i], to: edges[i + 1], count }))
}

export function PriceHistogram({
  fiche,
  fichesDept,
}: {
  fiche: Fiche
  fichesDept: Fiche[] | undefined
}) {
  const [echelle, setEchelle] = useState<Echelle>("departement")
  const { data: meta } = useMeta()

  const { data: distribution } = useQuery({
    queryKey: ["prix-distribution", meta?.base],
    queryFn: () => fetchPrixDistribution(meta!.base),
    enabled: !!meta && echelle === "france",
    staleTime: Infinity,
  })

  const bins = useMemo(() => {
    if (echelle === "departement") {
      return buildHistogram((fichesDept ?? []).map((f) => f.prix?.median), 24)
    }
    if (!distribution) return []
    return toBins(distribution.bin_edges, distribution.series.tous)
  }, [echelle, fichesDept, distribution])

  const median = fiche.prix?.median ?? null
  const communeBin = binIndexOf(bins, median)

  if (median == null) {
    return (
      <p className="text-sm text-muted-foreground">
        Pas d'agrégat de prix pour cette commune — pour Paris, Lyon et
        Marseille, consultez les fiches d'arrondissement.
      </p>
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {echelle === "departement"
            ? `Médianes des communes du département (${formatInt(
                bins.reduce((n, b) => n + b.count, 0),
              )} communes)`
            : `Transactions France entière, millésime ${distribution?.year ?? "…"}`}
        </p>
        <div className="flex gap-1 text-xs">
          {(["departement", "france"] as const).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEchelle(e)}
              className={cn(
                "rounded-md border px-2 py-1 transition-colors",
                echelle === e
                  ? "border-accent bg-accent/10 font-semibold text-accent"
                  : "border-input text-muted-foreground hover:bg-muted",
              )}
            >
              {e === "departement" ? "Département" : "France"}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={bins} margin={{ top: 8, right: 12, bottom: 0, left: 8 }} barCategoryGap={1}>
          <XAxis
            dataKey="from"
            tickFormatter={(v: number) => formatInt(v)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
          />
          <YAxis hide />
          <Tooltip
            formatter={(value) => [
              formatInt(typeof value === "number" ? value : null),
              echelle === "departement" ? "communes" : "ventes",
            ]}
            labelFormatter={(_, payload) => {
              const bin = payload?.[0]?.payload as HistogramBin | undefined
              return bin ? `${formatInt(bin.from)} – ${formatInt(bin.to)} €/m²` : ""
            }}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--foreground)",
            }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {bins.map((_, i) => (
              <Cell
                key={i}
                fill={i === communeBin ? "var(--chart-1)" : "var(--muted-foreground)"}
                fillOpacity={i === communeBin ? 1 : 0.35}
              />
            ))}
          </Bar>
          <ReferenceLine
            x={bins[communeBin ?? -1]?.from}
            stroke="var(--chart-1)"
            strokeDasharray="4 4"
            label={{
              value: formatEuroM2(median),
              position: "top",
              fill: "var(--foreground)",
              fontSize: 11,
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
