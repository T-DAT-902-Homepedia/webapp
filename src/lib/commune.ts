import { z } from "zod"

import { artifactUrl, fetchJson } from "@/lib/data"

// Fiches communes du CDN : un JSON par département (`communes/{dept}.json`),
// une entrée par commune. Contrat produit par duckpipe export_web.build_fiches
// — blocs prix/evolution/score/avis nullables, feuilles d'indicateurs
// individuellement nullables.

const prixTypeSchema = z.object({
  median: z.number().nullable(),
  nb_transactions: z.number().nullable(),
})

const prixSchema = z.object({
  median: z.number().nullable(),
  p25: z.number().nullable(),
  p75: z.number().nullable(),
  moyen: z.number().nullable(),
  nb_transactions: z.number().nullable(),
  fiable: z.boolean().nullable(),
  maison: prixTypeSchema.nullable(),
  appartement: prixTypeSchema.nullable(),
})

const evolutionPointSchema = z.object({
  annee: z.number(),
  prix_m2_median: z.number().nullable(),
  nb_transactions: z.number().nullable(),
})

export const composantesSchema = z.object({
  n_prix: z.number().nullable(),
  n_transport: z.number().nullable(),
  n_access_fin: z.number().nullable(),
  n_risques: z.number().nullable(),
  n_tourisme: z.number().nullable(),
  n_securite: z.number().nullable(),
  n_services: z.number().nullable(),
  n_loisirs: z.number().nullable(),
  n_ensoleillement: z.number().nullable(),
  n_emploi: z.number().nullable(),
  n_proximite: z.number().nullable(),
  n_dpe: z.number().nullable(),
})

const scoreSchema = z.object({
  score_valeur: z.number().nullable(),
  gap: z.number().nullable(),
  gap_pondere: z.number().nullable(),
  dpe_dominant: z.string().nullable(),
  composantes: composantesSchema,
})

const indicateursSchema = z.object({
  revenu_median: z.number().nullable(),
  taux_chomage: z.number().nullable(),
  taux_couverture_emploi: z.number().nullable(),
  pop_active: z.number().nullable(),
  densite_arrets_km2: z.number().nullable(),
  nb_arrets: z.number().nullable(),
  nb_services_sante: z.number().nullable(),
  nb_loisirs_culture: z.number().nullable(),
  taux_delinquance_global: z.number().nullable(),
  insee_pop: z.number().nullable(),
  part_residences_secondaires: z.number().nullable(),
  nb_arretes_catnat: z.number().nullable(),
  ensoleillement_h_an: z.number().nullable(),
  temperature_moy_annuelle: z.number().nullable(),
  dist_metropole_km: z.number().nullable(),
  nom_metropole: z.string().nullable(),
  surface_km2: z.number().nullable(),
})

// Bloc avis (runs à partir du merge de la chaîne NLP ; absent des runs
// antérieurs, d'où l'optional en plus du nullable).
const avisResumeSchema = z.object({
  n_avis: z.number(),
  sentiment_global: z.number().nullable(),
  periode: z.object({ debut: z.string().nullable(), fin: z.string().nullable() }),
  low_data: z.boolean(),
  mini_cloud: z
    .array(z.object({ word: z.string(), weight: z.number(), sentiment: z.string() }))
    .nullable(),
})

export const ficheSchema = z.object({
  code_commune: z.string(),
  nom_commune: z.string(),
  code_departement: z.string(),
  prix: prixSchema.nullable(),
  evolution: z.array(evolutionPointSchema).nullable(),
  score: scoreSchema.nullable(),
  indicateurs: indicateursSchema,
  avis: avisResumeSchema.nullable().optional(),
})

export type Fiche = z.infer<typeof ficheSchema>
export type Composantes = z.infer<typeof composantesSchema>
export type EvolutionPoint = z.infer<typeof evolutionPointSchema>

/** "75101"→"75", "2A004"→"2A", "97411"→"974". */
export function deptFromCodeCommune(code: string): string {
  return code.startsWith("97") ? code.slice(0, 3) : code.slice(0, 2)
}

export function fetchCommunesDept(base: string, dept: string): Promise<Fiche[]> {
  return fetchJson(artifactUrl(base, `communes/${dept}.json`), z.array(ficheSchema))
}
