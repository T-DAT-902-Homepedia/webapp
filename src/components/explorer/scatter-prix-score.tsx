import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"

import { useChoropleth } from "@/hooks/useChoropleth"
import { stratifiedSample } from "@/lib/sampling"
import { formatEuroM2, formatScore, formatSigned } from "@/lib/format"
import { cn } from "@/lib/utils"

// Nuage de points prix × score : chaque commune scorée est un point, la
// distance à la tendance EST l'écart qualité/prix (couleur PRGn du gap,
// cohérente avec la carte). Données = choroplèthe communale mid (déjà en
// cache si l'utilisateur a visité une carte), échantillonnée stratifiée à
// ~4k points hors filtre.

const TARGET_POINTS = 4000

// PRGn 7 classes (mêmes valeurs que la palette gap de la carte).
const PRGN = ["#762a83", "#af8dc3", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#7fbf7b", "#1b7837"]

function gapColor(gap: number | null | undefined, spread: number): string {
  if (gap == null) return "#9ca3af"
  const t = Math.max(-1, Math.min(1, gap / spread))
  return PRGN[Math.round(((t + 1) / 2) * (PRGN.length - 1))]
}

interface Point {
  code: string
  nom: string
  dept: string
  prix: number
  score: number
  gap: number | null
}

export function ScatterPrixScore() {
  const { data, isLoading } = useChoropleth("communes", "mid")
  const [dept, setDept] = useState("")
  const navigate = useNavigate()

  const allPoints = useMemo<Point[]>(
    () =>
      (data?.features ?? [])
        .map((f) => f.properties)
        .filter(
          (p) =>
            p.code_commune != null &&
            p.prix_m2_median != null &&
            p.score_valeur != null,
        )
        .map((p) => ({
          code: p.code_commune!,
          nom: p.nom,
          dept: p.code_departement,
          prix: p.prix_m2_median!,
          score: p.score_valeur!,
          gap: p.gap_pondere ?? null,
        })),
    [data],
  )

  const depts = useMemo(
    () =>
      [...new Set(allPoints.map((p) => p.dept))].sort((a, b) =>
        a.localeCompare(b, "fr", { numeric: true }),
      ),
    [allPoints],
  )

  // Échelle de couleur robuste : quantile 98 du |gap| (les outliers
  // n'écrasent pas la dynamique).
  const spread = useMemo(() => {
    const gaps = allPoints
      .map((p) => Math.abs(p.gap ?? 0))
      .sort((a, b) => a - b)
    return gaps.length ? Math.max(0.01, gaps[Math.floor(0.98 * gaps.length)]) : 0.1
  }, [allPoints])

  const points = useMemo(() => {
    // Filtre département : toutes ses communes (≤ 900, pas d'échantillon).
    if (dept) return allPoints.filter((p) => p.dept === dept)
    return stratifiedSample(allPoints, (p) => p.prix, TARGET_POINTS)
  }, [allPoints, dept])

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {dept
            ? `${points.length.toLocaleString("fr-FR")} communes du département ${dept}`
            : `${points.length.toLocaleString("fr-FR")} communes (échantillon de ${allPoints.length.toLocaleString("fr-FR")} scorées)`}
          {" · "}couleur = écart qualité/prix (vert = sous-cotée)
        </p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Département
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">Tous</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Chargement des communes…
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="prix"
              type="number"
              name="Prix"
              scale="log"
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `${Math.round(v / 100) / 10}k`}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              label={{
                value: "Prix médian (€/m², échelle log)",
                position: "insideBottom",
                offset: -4,
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
            <YAxis
              dataKey="score"
              type="number"
              name="Score"
              domain={[0, 1]}
              tickFormatter={(v: number) => String(Math.round(v * 100))}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={36}
              label={{
                value: "Score /100",
                angle: -90,
                position: "insideLeft",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
            <ZAxis range={[18, 18]} />
            <Tooltip
              cursor={{ strokeDasharray: "4 4" }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as Point | undefined
                if (!p) return null
                return (
                  <div className="rounded-lg border bg-background p-2.5 text-xs shadow-lg">
                    <div className="font-semibold">
                      {p.nom} <span className="text-muted-foreground">({p.dept})</span>
                    </div>
                    <div className="mt-1 space-y-0.5 text-muted-foreground">
                      <div>Prix : {formatEuroM2(p.prix)}</div>
                      <div>Score : {formatScore(p.score)}</div>
                      <div>Écart : {formatSigned(p.gap)}</div>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Cliquer pour ouvrir la fiche
                    </div>
                  </div>
                )
              }}
            />
            <Scatter
              data={points}
              fill="var(--chart-1)"
              shape={(props: unknown) => {
                const { cx, cy, payload } = props as {
                  cx: number
                  cy: number
                  payload: Point
                }
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={dept ? 4 : 2.5}
                    fill={gapColor(payload.gap, spread)}
                    fillOpacity={0.75}
                    stroke="var(--background)"
                    strokeWidth={0.5}
                    className={cn("cursor-pointer")}
                    onClick={() => navigate(`/commune/${payload.code}`)}
                  />
                )
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
