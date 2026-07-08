import { z } from "zod"

import { artifactUrl, fetchJson } from "@/lib/data"

// Index de recherche des 34 933 communes (clés courtes pour rester léger).
// Le ranking vit ici en fonctions pures (testées Vitest) ; le composant
// CommandDialog ne fait qu'afficher les ≤ 20 premiers résultats.

export const searchEntrySchema = z.object({
  c: z.string(), // code commune
  n: z.string(), // nom
  d: z.string(), // département
  p: z.number().nullable(), // prix médian arrondi
  s: z.number().nullable(), // score arrondi
})
export type SearchEntry = z.infer<typeof searchEntrySchema>

export function fetchSearchIndex(base: string): Promise<SearchEntry[]> {
  return fetchJson(artifactUrl(base, "search/index.json"), z.array(searchEntrySchema))
}

/** NFD + suppression des diacritiques + minuscules + séparateurs unifiés
 *  (tiret/apostrophe -> espace : « saint denis » trouve Saint-Denis). */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export interface PreparedIndex {
  entries: SearchEntry[]
  normalized: string[]
}

export function buildSearchIndex(entries: SearchEntry[]): PreparedIndex {
  return { entries, normalized: entries.map((e) => normalizeText(e.n)) }
}

const NUMERIC_QUERY = /^(\d|2a|2b)/i

/**
 * Ranking : préfixe exact > début de mot (après espace/tiret/apostrophe) >
 * inclusion. Requête numérique (ou 2A/2B) -> préfixe de code commune ou de
 * département. Scan linéaire : 35k × startsWith reste < 5 ms.
 */
export function searchCommunes(
  index: PreparedIndex,
  query: string,
  limit = 20,
): SearchEntry[] {
  const q = normalizeText(query)
  if (q.length < 2) return []

  if (NUMERIC_QUERY.test(q)) {
    const upper = query.trim().toUpperCase()
    return index.entries
      .filter((e) => e.c.startsWith(upper) || e.d.startsWith(upper))
      .slice(0, limit)
  }

  const prefix: SearchEntry[] = []
  const wordPrefix: SearchEntry[] = []
  const includes: SearchEntry[] = []
  for (let i = 0; i < index.normalized.length; i++) {
    const name = index.normalized[i]
    if (name.startsWith(q)) {
      prefix.push(index.entries[i])
    } else {
      const at = name.indexOf(q)
      if (at === -1) continue
      // Séparateurs déjà unifiés en espaces par normalizeText.
      if (name[at - 1] === " ") {
        wordPrefix.push(index.entries[i])
      } else {
        includes.push(index.entries[i])
      }
    }
    if (prefix.length >= limit) break
  }
  return [...prefix, ...wordPrefix, ...includes].slice(0, limit)
}
