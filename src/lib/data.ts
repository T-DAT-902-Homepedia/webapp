import { z } from "zod"

// Base du CDN statique (bucket GCS public, CORS ouvert). L'URL est en dur pour
// qu'aucun .env ne soit requis en dev ; VITE_DATA_URL permet de pointer ailleurs.
export const DATA_URL: string =
  import.meta.env.VITE_DATA_URL ?? "https://storage.googleapis.com/homepedia-web/v1"

// meta.json est le seul fichier muté du bucket (cache HTTP 5 min) : il donne le
// run courant (`base`) sous lequel vivent tous les artefacts immuables.
export const metaSchema = z.object({
  schema_version: z.literal(1),
  run_date: z.string(),
  year: z.number(),
  base: z.string(), // ex. "runs/2026-07-02"
  nb_communes: z.number(),
  nb_communes_scorees: z.number(),
  generated_at: z.string(),
})
export type Meta = z.infer<typeof metaSchema>

/** GET + parse zod. Erreur explicite avec URL et statut HTTP. */
export async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CDN ${url} -> ${res.status} ${res.statusText}`)
  return schema.parse(await res.json())
}

export const fetchMeta = () => fetchJson(`${DATA_URL}/meta.json`, metaSchema)

/** URL d'un artefact immuable du run courant. */
export const artifactUrl = (base: string, path: string) => `${DATA_URL}/${base}/${path}`
