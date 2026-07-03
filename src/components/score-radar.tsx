import { DIMENSIONS, METRIC_LABELS, type ScoreProperties } from "@/lib/score"

// Radar SVG des 12 dimensions (valeurs 0–1). Fait main : une lib de graphe serait
// disproportionnée pour un seul polygone à 12 sommets.
const N = DIMENSIONS.length
const CX = 100
const CY = 100
const R = 60

const angle = (i: number) => (-90 + (i * 360) / N) * (Math.PI / 180)
const pt = (i: number, v: number): [number, number] => [
  CX + Math.cos(angle(i)) * R * v,
  CY + Math.sin(angle(i)) * R * v,
]

export function ScoreRadar({ props }: { props: ScoreProperties }) {
  const vals = DIMENSIONS.map((d) => {
    const v = props[d]
    return typeof v === "number" ? Math.max(0, Math.min(1, v)) : 0
  })
  const polygon = vals.map((v, i) => pt(i, v).join(",")).join(" ")

  return (
    // viewBox élargi pour laisser la place aux libellés autour du cercle.
    <svg
      viewBox="-48 -20 296 240"
      className="w-full"
      role="img"
      aria-label="Profil de la commune sur 12 dimensions"
    >
      {/* Anneaux de repère */}
      {[0.25, 0.5, 0.75, 1].map((lvl) => (
        <circle
          key={lvl}
          cx={CX}
          cy={CY}
          r={R * lvl}
          fill="none"
          className="stroke-muted-foreground/20"
        />
      ))}

      {/* Axes + libellés */}
      {DIMENSIONS.map((d, i) => {
        const [ax, ay] = pt(i, 1)
        const [lx, ly] = pt(i, 1.16)
        const cos = Math.cos(angle(i))
        return (
          <g key={d}>
            <line
              x1={CX}
              y1={CY}
              x2={ax}
              y2={ay}
              className="stroke-muted-foreground/20"
            />
            <text
              x={lx}
              y={ly}
              fontSize={7}
              textAnchor={cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle"}
              dominantBaseline="middle"
              className="fill-muted-foreground"
            >
              {METRIC_LABELS[d]}
            </text>
          </g>
        )
      })}

      {/* Polygone des valeurs */}
      <polygon
        points={polygon}
        className="fill-accent/25 stroke-accent"
        strokeWidth={1.5}
      />
      {vals.map((v, i) => {
        const [x, y] = pt(i, v)
        return (
          <circle key={i} cx={x} cy={y} r={2} className="fill-accent">
            <title>
              {METRIC_LABELS[DIMENSIONS[i]]} : {v.toFixed(2)}
            </title>
          </circle>
        )
      })}
    </svg>
  )
}
