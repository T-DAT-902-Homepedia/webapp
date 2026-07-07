import { Link } from "react-router-dom"
import { GitCompareArrows, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Fiche } from "@/lib/commune"
import { formatEuroM2, formatInt, formatScore, formatSigned } from "@/lib/format"
import { cn } from "@/lib/utils"

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: "positive" | "negative"
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "positive" && "text-accent",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function CommuneHeader({ fiche }: { fiche: Fiche }) {
  const gap = fiche.score?.gap_pondere ?? null
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {fiche.nom_commune}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Département {fiche.code_departement} · INSEE {fiche.code_commune}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/map?commune=${fiche.code_commune}`}>
              <MapPin className="size-4" />
              Voir sur la carte
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/comparer?a=${fiche.code_commune}`}>
              <GitCompareArrows className="size-4" />
              Comparer
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="Prix médian"
          value={formatEuroM2(fiche.prix?.median)}
          sub={
            fiche.prix?.p25 != null && fiche.prix?.p75 != null
              ? `p25 ${formatEuroM2(fiche.prix.p25)} · p75 ${formatEuroM2(fiche.prix.p75)}`
              : undefined
          }
        />
        <Tile
          label="Score qualité de vie"
          value={formatScore(fiche.score?.score_valeur)}
          sub={fiche.score ? undefined : "Commune non scorée"}
        />
        <Tile
          label="Écart qualité/prix"
          value={formatSigned(gap)}
          tone={gap == null ? undefined : gap >= 0 ? "positive" : "negative"}
          sub={gap == null ? undefined : gap >= 0 ? "Sous-cotée" : "Surcotée"}
        />
        <Tile
          label="Transactions"
          value={formatInt(fiche.prix?.nb_transactions)}
          sub={fiche.prix?.fiable === false ? "Volume faible" : undefined}
        />
      </div>
    </div>
  )
}
