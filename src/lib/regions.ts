import { z } from "zod"

import { artifactUrl } from "@/lib/data"

// Agrégats régionaux (stats/regions.json) : mêmes colonnes que la choroplèthe
// régionale sans la géométrie. Absent des runs antérieurs à l'ajout de la
// maille régionale -> 404 traité comme « pas encore publié ».

export const regionStatsSchema = z.object({
  code_region: z.string(),
  nom: z.string(),
  prix_m2_median: z.number().nullable(),
  nb_transactions: z.number(),
  fiable: z.boolean(),
  maison_prix_m2_median: z.number().nullable(),
  maison_nb_transactions: z.number(),
  maison_fiable: z.boolean(),
  appart_prix_m2_median: z.number().nullable(),
  appart_nb_transactions: z.number(),
  appart_fiable: z.boolean(),
  score_median: z.number().nullable(),
  gap_pondere_median: z.number().nullable(),
  nb_communes_scorees: z.number(),
})
export type RegionStats = z.infer<typeof regionStatsSchema>

export async function fetchRegionStats(base: string): Promise<RegionStats[] | null> {
  const res = await fetch(artifactUrl(base, "stats/regions.json"))
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`CDN stats/regions.json -> ${res.status} ${res.statusText}`)
  return z.array(regionStatsSchema).parse(await res.json())
}
