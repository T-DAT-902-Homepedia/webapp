import { z } from "zod"

import { artifactUrl } from "@/lib/data"

// Analyse d'avis d'habitants (ville-ideale.fr, NLP CamemBERT côté pipeline) :
// un JSON par département couvert (`avis/{dept}.json`). Couverture partielle
// (~80 grandes villes) : un département sans commune couverte n'a PAS de
// fichier — le 404 est un état normal, traité comme « aucune donnée ».

const themeStatSchema = z.object({
  theme: z.string(),
  n_segments: z.number(),
  pct_positive: z.number().nullable(),
  pct_negative: z.number().nullable(),
  score: z.number().nullable(),
})

const wordSchema = z.object({
  word: z.string(),
  weight: z.number(),
  sentiment: z.string(),
  themes: z.array(z.string()).nullable(),
})

const verbatimSchema = z.object({
  text: z.string(),
  label: z.string(), // Positif | Négatif | Nuancé
  theme: z.string().nullable(),
  mois: z.string().nullable(),
  source: z.string().nullable(),
})

export const avisCommuneSchema = z.object({
  code_commune: z.string(),
  code_departement: z.string(),
  nom_ville: z.string().nullable(),
  n_avis: z.number(),
  periode: z.object({ debut: z.string().nullable(), fin: z.string().nullable() }),
  sentiment_global: z.number().nullable(),
  low_data: z.boolean(),
  // Masqués (null) par le pipeline quand low_data : « peu fiable » se montre,
  // ne se cache pas — mais ne s'agrège pas.
  themes: z.array(themeStatSchema).nullable(),
  wordcloud: z.array(wordSchema).nullable(),
  verbatims: z.array(verbatimSchema).nullable(),
  source: z.string().nullable(),
})

export type AvisCommune = z.infer<typeof avisCommuneSchema>
export type AvisWord = z.infer<typeof wordSchema>
export type AvisVerbatim = z.infer<typeof verbatimSchema>
export type AvisThemeStat = z.infer<typeof themeStatSchema>

/** 404 = département non couvert : tableau vide, pas une erreur. */
export async function fetchAvisDept(base: string, dept: string): Promise<AvisCommune[]> {
  const res = await fetch(artifactUrl(base, `avis/${dept}.json`))
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`CDN avis/${dept}.json -> ${res.status} ${res.statusText}`)
  return z.array(avisCommuneSchema).parse(await res.json())
}

// Thèmes du lexique NLP (pipelines/ville_ideale nlp/themes.py).
export const AVIS_THEMES: { id: string; label: string }[] = [
  { id: "securite", label: "Sécurité" },
  { id: "calme", label: "Calme" },
  { id: "transports", label: "Transports" },
  { id: "commerces", label: "Commerces" },
  { id: "education", label: "Éducation" },
  { id: "environnement", label: "Environnement" },
]

export const themeLabel = (id: string | null): string =>
  AVIS_THEMES.find((t) => t.id === id)?.label ?? (id ?? "Autre")

// Sémantique divergente PRGn, alignée sur la palette du gap de la carte
// (vert = positif, violet = négatif) — CVD-safe, identique light/dark.
export const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#1b7837",
  negative: "#762a83",
  neutral: "var(--muted-foreground)",
}
