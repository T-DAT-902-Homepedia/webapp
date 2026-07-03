import type { Geometry } from "geojson"
import { z } from "zod"

// Score territoire : GeoJSON exporté depuis le gold duckpipe et publié sur le
// bucket public homepedia-web (public + CORS). Le front le récupère directement
// par HTTP, comme un appel d'API — pas de fichier dans le repo, pas d'API métier.
// Surchargeable via VITE_SCORE_URL. La fraîcheur est gérée côté objet GCS
// (Cache-Control public, max-age=300).
const SCORE_URL =
  import.meta.env.VITE_SCORE_URL ??
  "https://storage.googleapis.com/homepedia-web/v1/score.geojson"

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

// --- Types ---------------------------------------------------------------------
// Les properties ne sont PAS validées au runtime (cf. fetchScore) : plutôt qu'un
// schéma zod jamais parsé, on décrit la forme en types TS. Les 12 dimensions
// `n_*` (chiffre normalisé 0–1) sont dérivées de DIMENSIONS.

type NumOrNull = number | null

export type ScoreProperties = {
  code_commune: string
  nom?: string | null
  dep?: string | null
  prix?: NumOrNull
  nb_transactions?: NumOrNull
  dpe?: string | null
  score_valeur: NumOrNull
  gap?: NumOrNull
  gap_pondere: NumOrNull
} & Record<(typeof DIMENSIONS)[number], NumOrNull>

export type ScoreFeature = {
  type: "Feature"
  geometry: Geometry // GeoJSON — consommé tel quel par deck.gl.
  properties: ScoreProperties
}

export type ScoreCollection = {
  type: "FeatureCollection"
  features: ScoreFeature[]
}

// On valide seulement la FORME de l'enveloppe (pas chaque feature) : valider
// ~18k features × ~20 champs bloquerait le thread principal plusieurs secondes,
// et un seul enregistrement fautif ferait échouer TOUTE la carte. La source est
// notre propre export contrôlé : une propriété manquante dégrade en "no data"
// pour la commune concernée (getFillColor -> NO_DATA), pas en crash global.
const scoreEnvelope = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.unknown()),
})

/** Charge le GeoJSON depuis le bucket (géométrie + toutes les métriques, un seul fetch). */
export async function fetchScore(): Promise<ScoreCollection> {
  const res = await fetch(SCORE_URL)
  if (!res.ok) {
    throw new Error(`score.geojson -> ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  scoreEnvelope.parse(json) // vérifie type + features:[] sans parcourir chaque feature
  return json as ScoreCollection
}
