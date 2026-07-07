import type { ReactNode } from "react"

import { PageShell } from "@/components/page-shell"
import { ScatterPrixScore } from "@/components/explorer/scatter-prix-score"
import { NationalDistribution } from "@/components/explorer/national-distribution"
import { RegionsPanel } from "@/components/explorer/regions-bars"
import { useMeta } from "@/hooks/useMeta"
import { formatInt } from "@/lib/format"

// Dashboard analytique national : distribution des prix, nuage prix × score,
// palmarès des régions. Complète les cartes (spatial) par le volet
// statistique/tabulaire du sujet.

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-3 rounded-xl border bg-card p-4">{children}</div>
    </section>
  )
}

export default function Explorer() {
  const { data: meta } = useMeta()

  return (
    <PageShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Explorer</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Le marché immobilier français en trois lectures : la distribution des
        prix, le rapport qualité/prix commune par commune, et le palmarès des
        régions.
        {meta &&
          ` Données ${meta.year} — ${formatInt(meta.nb_communes)} communes, dont ${formatInt(
            meta.nb_communes_scorees,
          )} scorées.`}
      </p>

      <div className="mt-8">
        <Section
          title="Distribution des prix au m²"
          subtitle="Toutes les ventes du millésime, par type de bien."
        >
          <NationalDistribution />
        </Section>

        <Section
          title="Prix × qualité de vie"
          subtitle="Chaque point est une commune scorée. Les communes au-dessus de la tendance offrent plus de qualité de vie que leur prix ne le suggère."
        >
          <ScatterPrixScore />
        </Section>

        <Section
          title="Régions"
          subtitle="Agrégats recalculés sur les transactions du millésime — analyse au niveau régional."
        >
          <RegionsPanel />
        </Section>
      </div>
    </PageShell>
  )
}
