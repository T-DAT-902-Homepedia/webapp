import type { ReactNode } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ScoreFeature } from "@/lib/score"
import { ScoreRadar } from "@/components/score-radar"

/** Petite tuile d'indicateur. */
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-background/50 p-2.5">
      <div className="text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  )
}

/** Panneau de détail d'une commune (ouvert au clic sur la carte). */
export function CommunePanel({
  feature,
  onClose,
}: {
  feature: ScoreFeature
  onClose: () => void
}) {
  const p = feature.properties
  const prix =
    p.prix != null ? `${Math.round(p.prix).toLocaleString("fr-FR")} €/m²` : "n/d"
  const score = p.score_valeur != null ? p.score_valeur.toFixed(2) : "—"
  const gap =
    p.gap_pondere != null
      ? (p.gap_pondere >= 0 ? "+" : "") + p.gap_pondere.toFixed(2)
      : "—"

  return (
    <aside className="flex h-svh w-80 shrink-0 flex-col overflow-y-auto border-l bg-card text-card-foreground">
      <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <div className="font-display text-base leading-tight font-bold">
            {p.nom ?? p.code_commune}
          </div>
          <div className="text-xs text-muted-foreground">
            {p.dep ? `Département ${p.dep} · ` : ""}
            {p.code_commune}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Fermer le panneau"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4">
        <Stat label="Prix médian" value={prix} />
        <Stat label="Score global" value={score} />
        <Stat label="Écart qualité/prix" value={gap} />
        <Stat label="DPE dominant" value={p.dpe ?? "n/d"} />
        <Stat label="Transactions" value={p.nb_transactions ?? "n/d"} />
      </div>

      <div className="border-t px-4 py-4">
        <div className="mb-1 text-xs font-semibold">Profil (12 dimensions)</div>
        <ScoreRadar props={p} />
      </div>
    </aside>
  )
}
