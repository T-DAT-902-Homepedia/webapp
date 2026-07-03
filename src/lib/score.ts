import { z } from "zod"

// Score territoire : GeoJSON statique exporté depuis le gold duckpipe (GCS) et
// servi tel quel par Firebase Hosting (bucket GCS privé -> pas de lecture directe
// navigateur). Fetch littéral root-relative, PAS via l'API.
const DATA_URL = "/data/score.geojson"

// Version : bust le cache HTTP quand le fichier est régénéré (nouveau run gold).
const DATA_VERSION = "1"

// --- Métriques exposées -------------------------------------------------------

// Dimensions normalisées (0–1) du score, dans l'ordre d'affichage du sélecteur.
export const DIMENSIONS = [
  "n_transport", "n_securite", "n_tourisme", "n_emploi", "n_risques", "n_dpe",
  "n_services", "n_loisirs", "n_ensoleillement", "n_proximite", "n_access_fin", "n_prix",
] as const

export type Metric = "score_valeur" | "gap_pondere" | (typeof DIMENSIONS)[number]

// Libellés FR pour le sélecteur.
export const METRIC_LABELS: Record<Metric, string> = {
  score_valeur: "Score global",
  gap_pondere: "Écart qualité/prix",
  n_transport: "Transport",
  n_securite: "Sécurité",
  n_tourisme: "Tourisme",
  n_emploi: "Emploi",
  n_risques: "Risques",
  n_dpe: "DPE",
  n_services: "Services",
  n_loisirs: "Loisirs",
  n_ensoleillement: "Ensoleillement",
  n_proximite: "Proximité",
  n_access_fin: "Accès financier",
  n_prix: "Prix",
}

// gap_pondere est centré sur 0 (peut être négatif) -> échelle divergente ; tout
// le reste est dans [0, 1] -> échelle séquentielle.
export const DIVERGING_METRICS: ReadonlySet<Metric> = new Set(["gap_pondere"])

// --- Schéma zod ---------------------------------------------------------------

const scoreProperties = z.object({
  code_commune: z.string(),
  nom: z.string().nullable().optional(),
  dep: z.string().nullable().optional(),
  prix: z.number().nullable().optional(),
  nb_transactions: z.number().nullable().optional(),
  dpe: z.string().nullable().optional(),
  score_valeur: z.number().nullable(),
  gap: z.number().nullable().optional(),
  gap_pondere: z.number().nullable(),
  n_transport: z.number().nullable(),
  n_securite: z.number().nullable(),
  n_tourisme: z.number().nullable(),
  n_emploi: z.number().nullable(),
  n_risques: z.number().nullable(),
  n_dpe: z.number().nullable(),
  n_services: z.number().nullable(),
  n_loisirs: z.number().nullable(),
  n_ensoleillement: z.number().nullable(),
  n_proximite: z.number().nullable(),
  n_access_fin: z.number().nullable(),
  n_prix: z.number().nullable(),
})

const scoreCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      geometry: z.any(), // GeoJSON — consommé tel quel par deck.gl.
      properties: scoreProperties,
    }),
  ),
})

export type ScoreCollection = z.infer<typeof scoreCollection>
export type ScoreFeature = ScoreCollection["features"][number]
export type ScoreProperties = z.infer<typeof scoreProperties>

/** Charge le GeoJSON statique (géométrie + toutes les métriques, un seul fetch). */
export async function fetchScore(): Promise<ScoreCollection> {
  const res = await fetch(`${DATA_URL}?v=${DATA_VERSION}`)
  if (!res.ok) {
    throw new Error(`score.geojson -> ${res.status} ${res.statusText}`)
  }
  return scoreCollection.parse(await res.json())
}
