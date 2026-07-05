import { z } from "zod"

import { artifactUrl, fetchJson } from "@/lib/data"

// Couche data des graphiques (#17) : artefacts JSON `{base}/charts/…` publiés
// par pipelines/webapp_export/export_charts.py. Jointure par code_commune.

// --- stats_communes.json --------------------------------------------------
// ~17,8k enregistrements : comme pour score.geojson on ne valide que
// l'enveloppe (un zod complet par ligne bloquerait le thread pour rien),
// la forme des lignes est décrite en types TS.

type NumOrNull = number | null

export type CommuneStats = {
  code_commune: string
  nom: string | null
  dep: string | null
  prix_m2_median: NumOrNull
  nb_transactions: NumOrNull
  taux_chomage: NumOrNull
  taux_couverture_emploi: NumOrNull
  revenu_median: NumOrNull
  ensoleillement_h_an: NumOrNull
  jours_ensoleilles: NumOrNull
  temperature_moy_annuelle: NumOrNull
  part_residences_secondaires: NumOrNull
  dist_metropole_km: NumOrNull
  nb_arrets: NumOrNull
  densite_arrets_km2: NumOrNull
}

const statsEnvelope = z.object({
  schema_version: z.literal(1),
  year: z.number(),
  communes: z.array(z.unknown()),
})

export async function fetchCommuneStats(base: string): Promise<CommuneStats[]> {
  const json = await fetchJson(
    artifactUrl(base, "charts/stats_communes.json"),
    statsEnvelope,
  )
  return json.communes as CommuneStats[]
}

// --- prix_distribution.json ------------------------------------------------

export const prixDistributionSchema = z.object({
  schema_version: z.literal(1),
  year: z.number(),
  bin_edges: z.array(z.number()),
  series: z.object({
    tous: z.array(z.number()),
    maison: z.array(z.number()),
    appartement: z.array(z.number()),
  }),
})
export type PrixDistribution = z.infer<typeof prixDistributionSchema>

export const fetchPrixDistribution = (base: string) =>
  fetchJson(artifactUrl(base, "charts/prix_distribution.json"), prixDistributionSchema)

// --- prix_series.json -------------------------------------------------------
// Médianes annuelles par commune (null = année sans assez de ventes).
// ~17k entrées -> enveloppe seule là aussi.

export type PrixSeries = {
  years: number[]
  national: NumOrNull[]
  communes: Record<string, NumOrNull[]>
}

const seriesEnvelope = z.object({
  schema_version: z.literal(1),
  years: z.array(z.number()),
  national: z.array(z.number().nullable()),
  communes: z.record(z.string(), z.unknown()),
})

export async function fetchPrixSeries(base: string): Promise<PrixSeries> {
  const json = await fetchJson(
    artifactUrl(base, "charts/prix_series.json"),
    seriesEnvelope,
  )
  return json as PrixSeries
}

// --- Jointure ---------------------------------------------------------------

/** Index par code_commune pour joindre un dataset aux features de la carte. */
export function byCommune<T extends { code_commune: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.code_commune, r]))
}
