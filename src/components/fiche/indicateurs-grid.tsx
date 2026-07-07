import type { ReactNode } from "react"

import type { Fiche } from "@/lib/commune"
import {
  formatDecimal,
  formatEuro,
  formatInt,
  formatPercent,
} from "@/lib/format"

// Grille des indicateurs bruts de la fiche (silver par commune), groupés par
// thème. Toutes les feuilles sont nullables -> « — ».

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export function IndicateursGrid({ indicateurs: i }: { indicateurs: Fiche["indicateurs"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Group title="Population">
        <Row label="Habitants" value={formatInt(i.insee_pop)} />
        <Row label="Surface" value={i.surface_km2 != null ? `${formatDecimal(i.surface_km2)} km²` : "—"} />
        <Row
          label="Résidences secondaires"
          value={formatPercent(i.part_residences_secondaires)}
        />
      </Group>
      <Group title="Emploi & revenus">
        <Row label="Revenu médian" value={formatEuro(i.revenu_median)} />
        <Row
          label="Taux de chômage"
          value={i.taux_chomage != null ? `${formatDecimal(i.taux_chomage)} %` : "—"}
        />
        <Row
          label="Couverture emploi"
          value={formatDecimal(i.taux_couverture_emploi, 2)}
        />
        <Row label="Population active" value={formatInt(i.pop_active)} />
      </Group>
      <Group title="Transports">
        <Row label="Arrêts de transport" value={formatInt(i.nb_arrets)} />
        <Row
          label="Densité d'arrêts"
          value={i.densite_arrets_km2 != null ? `${formatDecimal(i.densite_arrets_km2)} /km²` : "—"}
        />
        <Row
          label="Métropole la plus proche"
          value={
            i.dist_metropole_km != null
              ? `${i.nom_metropole ?? "?"} (${formatInt(i.dist_metropole_km)} km)`
              : "—"
          }
        />
      </Group>
      <Group title="Services & loisirs">
        <Row label="Services & santé" value={formatInt(i.nb_services_sante)} />
        <Row label="Loisirs & culture" value={formatInt(i.nb_loisirs_culture)} />
      </Group>
      <Group title="Sécurité & risques">
        <Row
          label="Taux de délinquance"
          value={
            i.taux_delinquance_global != null
              ? `${formatDecimal(i.taux_delinquance_global)} ‰`
              : "—"
          }
        />
        <Row label="Arrêtés catastrophe naturelle" value={formatInt(i.nb_arretes_catnat)} />
      </Group>
      <Group title="Climat">
        <Row
          label="Ensoleillement"
          value={i.ensoleillement_h_an != null ? `${formatInt(i.ensoleillement_h_an)} h/an` : "—"}
        />
        <Row
          label="Température moyenne"
          value={
            i.temperature_moy_annuelle != null
              ? `${formatDecimal(i.temperature_moy_annuelle)} °C`
              : "—"
          }
        />
      </Group>
    </div>
  )
}
