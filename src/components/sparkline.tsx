// Mini-courbe SVG faite main (comme le radar : une lib serait disproportionnée
// pour une polyline). Gère les trous (valeurs null) en coupant le tracé.

const W = 72
const H = 20
const PAD = 2

export function Sparkline({
  values,
  labels,
}: {
  values: (number | null)[]
  labels: (string | number)[]
}) {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length < 2) return <span className="text-muted-foreground">—</span>

  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const x = (i: number) => PAD + (i / (values.length - 1)) * (W - 2 * PAD)
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD)

  // Segments continus entre valeurs présentes (un null coupe la ligne).
  const segments: string[] = []
  let current: string[] = []
  values.forEach((v, i) => {
    if (v == null) {
      if (current.length > 1) segments.push(current.join(" "))
      current = []
    } else {
      current.push(`${x(i)},${y(v)}`)
    }
  })
  if (current.length > 1) segments.push(current.join(" "))

  const last = [...values].reverse().find((v) => v != null)
  const first = nums[0]
  const trendUp = last != null && last >= first

  const title = values
    .map((v, i) => `${labels[i]} : ${v != null ? `${v.toLocaleString("fr-FR")} €/m²` : "n/d"}`)
    .join("\n")

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={trendUp ? "text-accent" : "text-destructive"}
      role="img"
      aria-label="Évolution du prix au m²"
    >
      <title>{title}</title>
      {segments.map((points, i) => (
        <polyline
          key={i}
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {values.map((v, i) =>
        v != null ? (
          <circle key={i} cx={x(i)} cy={y(v)} r={1.5} fill="currentColor" />
        ) : null,
      )}
    </svg>
  )
}
