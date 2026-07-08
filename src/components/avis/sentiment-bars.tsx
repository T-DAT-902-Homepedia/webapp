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

import { SENTIMENT_COLORS, themeLabel, type AvisThemeStat } from "@/lib/avis"
import { formatPercent } from "@/lib/format"

// Baromètre du sentiment par thème : barres divergentes autour de 0
// (négatif à gauche en violet, positif à droite en vert), thèmes triés du
// mieux au moins bien perçu.

export function SentimentBars({
  themes,
  onThemeClick,
  activeTheme,
}: {
  themes: AvisThemeStat[]
  activeTheme: string | null
  onThemeClick?: (theme: string | null) => void
}) {
  const data = [...themes]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((t) => ({
      theme: t.theme,
      label: themeLabel(t.theme),
      positive: t.pct_positive ?? 0,
      negative: -(t.pct_negative ?? 0),
      n: t.n_segments,
    }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }} stackOffset="sign">
        <XAxis
          type="number"
          domain={[-1, 1]}
          tickFormatter={(v: number) => formatPercent(Math.abs(v), 0)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={92}
          tick={{ fill: "var(--foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value, name) => [
            formatPercent(Math.abs(typeof value === "number" ? value : 0), 0),
            name === "positive" ? "segments positifs" : "segments négatifs",
          ]}
          labelFormatter={(label, payload) => {
            const n = payload?.[0]?.payload?.n as number | undefined
            return n != null ? `${label} — ${n} segments` : String(label)
          }}
          contentStyle={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--foreground)",
          }}
        />
        <ReferenceLine x={0} stroke="var(--border)" />
        {(["negative", "positive"] as const).map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="sentiment"
            fill={SENTIMENT_COLORS[key]}
            radius={key === "positive" ? [0, 3, 3, 0] : [3, 0, 0, 3]}
            cursor={onThemeClick ? "pointer" : undefined}
            onClick={(entry) => {
              const theme = (entry as unknown as { theme?: string }).theme ?? null
              onThemeClick?.(theme === activeTheme ? null : theme)
            }}
          >
            {data.map((d) => (
              <Cell key={d.theme} fillOpacity={activeTheme && d.theme !== activeTheme ? 0.3 : 1} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
