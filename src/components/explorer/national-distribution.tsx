import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { fetchPrixDistribution } from "@/lib/charts"
import { useMeta } from "@/hooks/useMeta"
import { formatInt } from "@/lib/format"
import { cn } from "@/lib/utils"

// Distribution nationale des prix au m² (histogrammes pré-binnés par le
// pipeline sur les transactions du millésime), filtrable par type de bien.

type Serie = "tous" | "maison" | "appartement"
const SERIES: { id: Serie; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "maison", label: "Maisons" },
  { id: "appartement", label: "Appartements" },
]

export function NationalDistribution() {
  const { data: meta } = useMeta()
  const [serie, setSerie] = useState<Serie>("tous")

  const { data } = useQuery({
    queryKey: ["prix-distribution", meta?.base],
    queryFn: () => fetchPrixDistribution(meta!.base),
    enabled: !!meta,
    staleTime: Infinity,
  })

  if (!data) {
    return <p className="text-sm text-muted-foreground">Chargement de la distribution…</p>
  }

  const bins = data.series[serie].map((count, i) => ({
    from: data.bin_edges[i],
    to: data.bin_edges[i + 1],
    count,
  }))
  const total = bins.reduce((n, b) => n + b.count, 0)

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {formatInt(total)} ventes, millésime {data.year}
        </p>
        <div className="flex gap-1 text-xs">
          {SERIES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSerie(s.id)}
              className={cn(
                "rounded-md border px-2 py-1 transition-colors",
                serie === s.id
                  ? "border-accent bg-accent/10 font-semibold text-accent"
                  : "border-input text-muted-foreground hover:bg-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={bins} margin={{ top: 4, right: 12, bottom: 0, left: 8 }} barCategoryGap={1}>
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
            formatter={(value) => [formatInt(typeof value === "number" ? value : null), "ventes"]}
            labelFormatter={(_, payload) => {
              const bin = payload?.[0]?.payload as { from: number; to: number } | undefined
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
          <Bar dataKey="count" fill="var(--chart-1)" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
