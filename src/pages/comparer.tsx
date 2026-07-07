import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Plus, X } from "lucide-react"

import { PageShell } from "@/components/page-shell"
import { SearchCommand } from "@/components/search-command"
import { ScoreRadar, type RadarSerie } from "@/components/fiche/score-radar"
import { EvolutionChart, type EvolutionSerie } from "@/components/fiche/evolution-chart"
import { Button } from "@/components/ui/button"
import { useFiche } from "@/hooks/useFiche"
import type { Fiche } from "@/lib/commune"
import {
  formatDecimal,
  formatEuro,
  formatEuroM2,
  formatInt,
  formatPercent,
  formatScore,
  formatSigned,
} from "@/lib/format"
import { cn } from "@/lib/utils"

// Comparaison de deux communes côte à côte. L'URL (?a=&b=) est la source de
// vérité : partageable, back/forward restaurent l'état. Couleurs FIXES par
// emplacement (A bleu --chart-1, B orange --chart-3), jamais par ordre de
// chargement.

type Slot = "a" | "b"
const SLOT_COLOR: Record<Slot, string> = { a: "--chart-1", b: "--chart-3" }
const SLOT_LABEL: Record<Slot, string> = { a: "Commune A", b: "Commune B" }

function SlotCard({
  slot,
  fiche,
  status,
  onPick,
  onClear,
}: {
  slot: Slot
  fiche: Fiche | undefined
  status: "empty" | "loading" | "notfound" | "ok"
  onPick: () => void
  onClear: () => void
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: `var(${SLOT_COLOR[slot]})` }}
        >
          {SLOT_LABEL[slot]}
        </span>
        {fiche && (
          <Button variant="ghost" size="icon" onClick={onClear} aria-label="Retirer">
            <X className="size-4" />
          </Button>
        )}
      </div>
      {status === "ok" && fiche ? (
        <div className="mt-1">
          <div className="font-display text-xl font-bold">{fiche.nom_commune}</div>
          <div className="text-xs text-muted-foreground">
            Dépt {fiche.code_departement} · {fiche.code_commune}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Prix</div>
              <div className="font-semibold tabular-nums">
                {formatEuroM2(fiche.prix?.median)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Score</div>
              <div className="font-semibold tabular-nums">
                {formatScore(fiche.score?.score_valeur)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Écart</div>
              <div
                className={cn(
                  "font-semibold tabular-nums",
                  (fiche.score?.gap_pondere ?? 0) >= 0 ? "text-accent" : "text-destructive",
                )}
              >
                {formatSigned(fiche.score?.gap_pondere)}
              </div>
            </div>
          </div>
        </div>
      ) : status === "loading" ? (
        <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
      ) : status === "notfound" ? (
        <p className="mt-4 text-sm text-destructive">Commune introuvable.</p>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <Plus className="size-4" />
          Choisir une commune
        </button>
      )}
    </div>
  )
}

const COMPARE_ROWS: {
  label: string
  value: (f: Fiche) => string
}[] = [
  { label: "Prix médian", value: (f) => formatEuroM2(f.prix?.median) },
  { label: "Transactions", value: (f) => formatInt(f.prix?.nb_transactions) },
  { label: "Score qualité de vie", value: (f) => formatScore(f.score?.score_valeur) },
  { label: "Écart qualité/prix", value: (f) => formatSigned(f.score?.gap_pondere) },
  { label: "DPE dominant", value: (f) => f.score?.dpe_dominant ?? "—" },
  { label: "Habitants", value: (f) => formatInt(f.indicateurs.insee_pop) },
  { label: "Revenu médian", value: (f) => formatEuro(f.indicateurs.revenu_median) },
  {
    label: "Taux de chômage",
    value: (f) =>
      f.indicateurs.taux_chomage != null
        ? `${formatDecimal(f.indicateurs.taux_chomage)} %`
        : "—",
  },
  { label: "Arrêts de transport", value: (f) => formatInt(f.indicateurs.nb_arrets) },
  {
    label: "Distance métropole",
    value: (f) =>
      f.indicateurs.dist_metropole_km != null
        ? `${formatInt(f.indicateurs.dist_metropole_km)} km (${f.indicateurs.nom_metropole ?? "?"})`
        : "—",
  },
  { label: "Services & santé", value: (f) => formatInt(f.indicateurs.nb_services_sante) },
  {
    label: "Taux de délinquance",
    value: (f) =>
      f.indicateurs.taux_delinquance_global != null
        ? `${formatDecimal(f.indicateurs.taux_delinquance_global)} ‰`
        : "—",
  },
  {
    label: "Résidences secondaires",
    value: (f) => formatPercent(f.indicateurs.part_residences_secondaires),
  },
  {
    label: "Ensoleillement",
    value: (f) =>
      f.indicateurs.ensoleillement_h_an != null
        ? `${formatInt(f.indicateurs.ensoleillement_h_an)} h/an`
        : "—",
  },
]

export default function Comparer() {
  const [params, setParams] = useSearchParams()
  const [picking, setPicking] = useState<Slot | null>(null)

  const codeA = params.get("a") ?? undefined
  const codeB = params.get("b") ?? undefined
  const ficheA = useFiche(codeA)
  const ficheB = useFiche(codeB)

  const setSlot = (slot: Slot, code: string | null) => {
    const next = new URLSearchParams(params)
    if (code) next.set(slot, code)
    else next.delete(slot)
    setParams(next)
  }

  const statusOf = (
    code: string | undefined,
    q: ReturnType<typeof useFiche>,
  ): "empty" | "loading" | "notfound" | "ok" => {
    if (!code) return "empty"
    if (q.isLoading) return "loading"
    if (q.isError || (q.isSuccess && !q.data)) return "notfound"
    return q.data ? "ok" : "loading"
  }

  const same = codeA && codeA === codeB
  const slots: { slot: Slot; fiche: Fiche | undefined }[] = [
    { slot: "a", fiche: ficheA.data },
    { slot: "b", fiche: ficheB.data },
  ]
  const loaded = slots.filter((s) => s.fiche) as { slot: Slot; fiche: Fiche }[]

  const radarSeries: RadarSerie[] = loaded
    .filter((s) => s.fiche.score)
    .map((s) => ({
      label: s.fiche.nom_commune,
      composantes: s.fiche.score!.composantes,
      colorVar: SLOT_COLOR[s.slot],
    }))

  const evolutionSeries: EvolutionSerie[] = loaded
    .filter((s) => s.fiche.evolution?.length)
    .map((s) => ({
      label: s.fiche.nom_commune,
      points: s.fiche.evolution!,
      colorVar: SLOT_COLOR[s.slot],
    }))

  return (
    <PageShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Comparer deux communes
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Profils de score superposés, évolutions de prix et indicateurs côte à côte.
      </p>

      {same && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Choisissez deux communes différentes.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {slots.map(({ slot }) => (
          <SlotCard
            key={slot}
            slot={slot}
            fiche={slot === "a" ? ficheA.data : ficheB.data}
            status={statusOf(
              slot === "a" ? codeA : codeB,
              slot === "a" ? ficheA : ficheB,
            )}
            onPick={() => setPicking(slot)}
            onClear={() => setSlot(slot, null)}
          />
        ))}
      </div>

      {loaded.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-display text-lg font-bold tracking-tight">
              Profils de score
            </h2>
            {radarSeries.length > 0 ? (
              <>
                <ScoreRadar series={radarSeries} />
                <div className="mt-1 flex justify-center gap-4 text-xs">
                  {radarSeries.map((s) => (
                    <span key={s.label} className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: `var(${s.colorVar})` }}
                      />
                      {s.label}
                    </span>
                  ))}
                </div>
                {loaded.some((s) => !s.fiche.score) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {loaded.find((s) => !s.fiche.score)?.fiche.nom_commune} n'est
                    pas scorée (série omise).
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Aucune des communes sélectionnées n'est scorée.
              </p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-display text-lg font-bold tracking-tight">
              Évolution du prix au m²
            </h2>
            {evolutionSeries.length > 0 ? (
              <EvolutionChart series={evolutionSeries} />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Pas d'agrégat communal (Paris/Lyon/Marseille : voir les
                arrondissements).
              </p>
            )}
          </section>
        </div>
      )}

      {loaded.length === 2 && !same && (
        <section className="mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">
                  Indicateur
                </th>
                {loaded.map((s) => (
                  <th
                    key={s.slot}
                    className="px-3 py-2.5 text-right font-semibold"
                    style={{ color: `var(${SLOT_COLOR[s.slot]})` }}
                  >
                    {s.fiche.nom_commune}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="border-b last:border-b-0">
                  <td className="px-3 py-2 text-muted-foreground">{row.label}</td>
                  {loaded.map((s) => (
                    <td key={s.slot} className="px-3 py-2 text-right tabular-nums">
                      {row.value(s.fiche)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <SearchCommand
        open={picking !== null}
        onClose={() => setPicking(null)}
        onSelect={(entry) => picking && setSlot(picking, entry.c)}
      />
    </PageShell>
  )
}
