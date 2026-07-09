import type { ReactNode } from "react"

import type { IrisProperties } from "@/lib/iris"
import { formatEuroM2, formatInt, formatScore, formatSigned } from "@/lib/format"

/**
 * Corps du tooltip quartier (IRIS), partagé par les deux cartes. Le prix est
 * une médiane poolée sur plusieurs millésimes : on affiche sa période plutôt
 * que de l'opposer chiffre à chiffre au prix communal (millésime courant).
 * Le score est hérité de la commune — mention explicite. `children` s'insère
 * après le titre (ex. : la métrique courante de la carte score).
 */
export function IrisTooltipContent({
  p,
  clickHint,
  children,
}: {
  p: IrisProperties
  clickHint?: string
  children?: ReactNode
}) {
  const periode =
    p.annee_min != null && p.annee_max != null
      ? ` ${p.annee_min}–${p.annee_max}`
      : ""
  return (
    <>
      <div className="font-display font-semibold">{p.nom}</div>
      <div className="text-xs text-muted-foreground">
        Quartier de {p.nom_commune}
      </div>
      {children}
      <div className="mt-1">
        Prix médian{periode} :{" "}
        <span className="font-semibold text-accent">
          {formatEuroM2(p.prix_m2_median)}
        </span>
      </div>
      <div className="text-muted-foreground">
        {formatInt(p.nb_transactions)} transactions
        {p.fiable ? "" : " (faible volume)"}
      </div>
      <div className="text-muted-foreground">
        Écart qualité/prix : {formatSigned(p.gap_pondere_iris)}
      </div>
      <div className="text-muted-foreground">
        Score : {formatScore(p.score_commune)} — score de la commune
      </div>
      {clickHint && (
        <div className="mt-1 text-xs text-muted-foreground">{clickHint}</div>
      )}
    </>
  )
}
