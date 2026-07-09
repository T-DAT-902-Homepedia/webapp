import { z } from "zod"

// Base du CDN statique (bucket GCS public, CORS ouvert). L'URL est en dur pour
// qu'aucun .env ne soit requis en dev ; VITE_DATA_URL permet de pointer ailleurs.
export const DATA_URL: string =
  import.meta.env.VITE_DATA_URL ?? "https://storage.googleapis.com/homepedia-web/v1"

// meta.json est le seul fichier muté du bucket (cache HTTP 5 min) : il donne le
// run courant (`base`) sous lequel vivent tous les artefacts immuables.
export const metaSchema = z.object({
  // Tolère un futur bump : les évolutions du pipeline sont additives, un
  // numéro inconnu ne doit pas casser la carte (les champs requis restent
  // validés champ à champ).
  schema_version: z.number(),
  run_date: z.string(),
  year: z.number(),
  base: z.string(), // ex. "runs/2026-07-02"
  nb_communes: z.number(),
  nb_communes_scorees: z.number(),
  // Communes couvertes par l'analyse d'avis (0 ou absent = pas d'avis dans ce
  // run : les sections Avis se masquent d'elles-mêmes).
  nb_communes_avis: z.number().optional(),
  // Maille quartier IRIS (0 ou absent = run sans quartiers : la couche carte
  // reste masquée).
  nb_iris: z.number().optional(),
  nb_iris_scores: z.number().optional(),
  generated_at: z.string(),
})
export type Meta = z.infer<typeof metaSchema>

/** GET + parse zod. Erreur explicite avec URL et statut HTTP. */
export async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CDN ${url} -> ${res.status} ${res.statusText}`)
  return schema.parse(await res.json())
}

// Version du run courant (generated_at), mémorisée au fetch de meta.json.
// Le bucket sert les artefacts en `max-age=31536000, immutable`, mais le
// pipeline peut re-publier un run au même chemin (correctif de données) : le
// `?v=` dérivé de meta casse alors le cache navigateur en ≤ 5 min (TTL de
// meta.json) — sans lui, une géométrie corrigée mettrait un an à se propager
// (Nouvelle-Aquitaine invisible, run 2026-07-07 re-publié le 09).
let runVersion = ""

export const fetchMeta = async () => {
  const meta = await fetchJson(`${DATA_URL}/meta.json`, metaSchema)
  runVersion = meta.generated_at
  return meta
}

/** URL d'un artefact du run courant, versionnée par meta.generated_at. */
export const artifactUrl = (base: string, path: string) =>
  `${DATA_URL}/${base}/${path}${runVersion ? `?v=${encodeURIComponent(runVersion)}` : ""}`
