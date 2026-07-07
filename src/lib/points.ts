import { z } from "zod"

import { artifactUrl, fetchJson } from "@/lib/data"

// Échantillon de mutations géolocalisées (points/transactions-sample.json,
// ~100k lignes) pour la heatmap et les isolignes. Chargé uniquement quand la
// représentation « heat » est active.

export const pointSchema = z.object({
  lon: z.number(),
  lat: z.number(),
  prix: z.number(),
  t: z.string(), // 'M' maison | 'A' appartement
})
export type TransactionPoint = z.infer<typeof pointSchema>

export function fetchPointsSample(base: string): Promise<TransactionPoint[]> {
  return fetchJson(
    artifactUrl(base, "points/transactions-sample.json"),
    z.array(pointSchema),
  )
}
