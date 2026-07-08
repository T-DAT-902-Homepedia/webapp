import type { ReactNode } from "react"
import { Link, useParams } from "react-router-dom"

import { PageShell } from "@/components/page-shell"
import { CommuneHeader } from "@/components/fiche/commune-header"
import { ScoreRadar } from "@/components/fiche/score-radar"
import { EvolutionChart } from "@/components/fiche/evolution-chart"
import { PriceHistogram } from "@/components/fiche/price-histogram"
import { IndicateursGrid } from "@/components/fiche/indicateurs-grid"
import { AvisSection } from "@/components/avis/avis-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFiche, useFichesDept } from "@/hooks/useFiche"
import { usePrixSeries } from "@/hooks/usePrixSeries"
import { deptFromCodeCommune, type Fiche } from "@/lib/commune"
import { COMPOSANTES_CONTEXTE } from "@/lib/score"
import { formatScore } from "@/lib/format"

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

/** Jauges des composantes hors score (contexte) + badge DPE. */
function ContexteGauges({ fiche }: { fiche: Fiche }) {
  const score = fiche.score
  if (!score) return null
  return (
    <div className="mt-4 border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Contexte (hors score)
        </span>
        {score.dpe_dominant && <Badge variant="outline">DPE {score.dpe_dominant}</Badge>}
      </div>
      <div className="space-y-2">
        {COMPOSANTES_CONTEXTE.map((c) => {
          const v = score.composantes[c.key]
          return (
            <div key={c.key} className="flex items-center gap-2 text-xs">
              <span className="w-36 shrink-0 text-muted-foreground">{c.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-chart-2"
                  style={{ width: `${((v ?? 0) * 100).toFixed(0)}%` }}
                />
              </div>
              <span className="w-14 text-right tabular-nums">{formatScore(v)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Commune() {
  const { code } = useParams<{ code: string }>()
  const { data: fiche, isLoading, isError, isSuccess } = useFiche(code)
  const { data: fichesDept } = useFichesDept(code ? deptFromCodeCommune(code) : undefined)
  const { data: series } = usePrixSeries()

  if (isLoading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Chargement de la fiche…</p>
      </PageShell>
    )
  }
  if (isError || (isSuccess && !fiche)) {
    return (
      <PageShell>
        <h1 className="font-display text-2xl font-bold">Commune introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Aucune fiche pour le code « {code} ».
        </p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/carte">Retour à la carte</Link>
        </Button>
      </PageShell>
    )
  }
  if (!fiche) return null

  const national = series
    ? {
        label: "Médiane France",
        colorVar: "--muted-foreground",
        points: series.years.map((annee, i) => ({
          annee,
          prix_m2_median: series.national[i],
          nb_transactions: null,
        })),
      }
    : undefined

  return (
    <PageShell>
      <CommuneHeader fiche={fiche} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-display text-lg font-bold tracking-tight">
            Anatomie du score
          </h2>
          {fiche.score ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Les 9 dimensions pondérées du score, ordonnées par poids décroissant.
              </p>
              <ScoreRadar
                series={[
                  {
                    label: fiche.nom_commune,
                    composantes: fiche.score.composantes,
                    colorVar: "--chart-1",
                  },
                ]}
              />
              <ContexteGauges fiche={fiche} />
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Commune non scorée (moins de 5 transactions DVF sur le millésime).
            </p>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-display text-lg font-bold tracking-tight">
            Évolution du prix au m²
          </h2>
          {fiche.evolution?.length ? (
            <EvolutionChart
              series={[
                {
                  label: fiche.nom_commune,
                  points: fiche.evolution,
                  colorVar: "--chart-1",
                },
              ]}
              reference={national}
            />
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Pas d'agrégat communal — pour Paris, Lyon et Marseille, consultez
              les fiches d'arrondissement.
            </p>
          )}
        </section>
      </div>

      <Section title="Position dans la distribution des prix">
        <div className="rounded-xl border bg-card p-4">
          <PriceHistogram fiche={fiche} fichesDept={fichesDept} />
        </div>
      </Section>

      <AvisSection codeCommune={fiche.code_commune} />

      <Section title="Indicateurs">
        <IndicateursGrid indicateurs={fiche.indicateurs} />
      </Section>
    </PageShell>
  )
}
