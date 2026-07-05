import {
  METRIC_LABELS,
  SOURCE_GROUPS,
  type ScoreProperties,
} from "@/lib/score"

// Radar SVG des 5 sources de données du sujet (valeurs 0–1) : chaque axe est la
// moyenne des dimensions n_* de sa source (cf. SOURCE_GROUPS). Fait main : une
// lib de graphe serait disproportionnée pour un seul polygone à 5 sommets.
const N = SOURCE_GROUPS.length
const CX = 100
const CY = 100
const R = 60

const angle = (i: number) => (-90 + (i * 360) / N) * (Math.PI / 180)
const pt = (i: number, v: number): [number, number] => [
  CX + Math.cos(angle(i)) * R * v,
  CY + Math.sin(angle(i)) * R * v,
]

/** Valeur 0–1 de chaque source : moyenne des dimensions renseignées du groupe
 *  (les NULL sont ignorés ; groupe entièrement vide -> 0). */
export function sourceProfile(properties: ScoreProperties): number[] {
  return SOURCE_GROUPS.map((g) => {
    const nums = g.dims
      .map((d) => properties[d])
      .filter((v): v is number => typeof v === "number")
    if (nums.length === 0) return 0
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    return Math.max(0, Math.min(1, mean))
  })
}

export function ScoreRadar({ properties }: { properties: ScoreProperties }) {
  const vals = sourceProfile(properties)
  const polygon = vals.map((v, i) => pt(i, v).join(",")).join(" ")

  return (
    // viewBox élargi pour laisser la place aux libellés autour du cercle.
    <svg
      viewBox="-48 -20 296 240"
      className="w-full"
      role="img"
      aria-label="Profil de la commune sur les 5 sources de données"
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
      {SOURCE_GROUPS.map((g, i) => {
        const [ax, ay] = pt(i, 1)
        const [lx, ly] = pt(i, 1.16)
        const cos = Math.cos(angle(i))
        return (
          <g key={g.label}>
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
              fontSize={8}
              textAnchor={cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle"}
              dominantBaseline="middle"
              className="fill-muted-foreground"
            >
              {g.label}
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
        const g = SOURCE_GROUPS[i]
        // Détail des dimensions du groupe au survol du sommet.
        const detail = g.dims
          .map((d) => {
            const dv = properties[d]
            return `${METRIC_LABELS[d]} ${typeof dv === "number" ? dv.toFixed(2) : "n/d"}`
          })
          .join(" · ")
        return (
          <circle key={i} cx={x} cy={y} r={2} className="fill-accent">
            <title>
              {g.label} : {v.toFixed(2)} ({detail})
            </title>
          </circle>
        )
      })}
    </svg>
  )
}
