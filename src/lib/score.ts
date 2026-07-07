import type { Geometry } from "geojson"
import { z } from "zod"

import { artifactUrl } from "@/lib/data"

// Score territoire : depuis la consolidation ADR-0014, la choroplèthe
// communale versionnée (meta.json -> runs/{run}/choropleth/communes-mid)
// expose TOUTES les métriques — score, gap, dimensions ET prix par type de
// bien. L'ancien v1/score.geojson (déprécié) n'est plus consommé ; on adapte
// ici les properties au format historique de la page pour ne pas réécrire
// tous ses consommateurs.

// --- Métriques exposées -------------------------------------------------------

// Dimensions normalisées (0–1) du score, dans l'ordre d'affichage du sélecteur.
export const DIMENSIONS = [
  "n_transport", "n_securite", "n_tourisme", "n_emploi", "n_risques", "n_dpe",
  "n_services", "n_loisirs", "n_ensoleillement", "n_proximite", "n_access_fin", "n_prix",
] as const

// Métriques prix (€/m², médianes DVF) — sélectionnables et croisables en
// bivarié comme les autres (ex. prix × sécurité).
export const PRIX_METRICS = ["prix", "prix_maison", "prix_appart"] as const

export type Metric =
  | "score_valeur"
  | "gap_pondere"
  | (typeof PRIX_METRICS)[number]
  | (typeof DIMENSIONS)[number]

/** Métriques en euros (formatage et légende dédiés). */
export const EURO_METRICS: ReadonlySet<Metric> = new Set(PRIX_METRICS)

export type Dimension = (typeof DIMENSIONS)[number]

// Les 12 dimensions regroupées par source de données du sujet : les 5 axes du
// radar de la fiche commune (1 axe = 1 des 5 types de données de la
// problématique — immobilier, transport, climat/risques, tourisme, socio).
export const SOURCE_GROUPS: { label: string; dims: Dimension[] }[] = [
  { label: "Immobilier", dims: ["n_prix", "n_access_fin"] },
  { label: "Transport", dims: ["n_transport", "n_proximite"] },
  { label: "Climat & risques", dims: ["n_risques", "n_dpe", "n_ensoleillement"] },
  { label: "Tourisme", dims: ["n_tourisme", "n_loisirs"] },
  { label: "Socio-démo", dims: ["n_emploi", "n_securite", "n_services"] },
]

// Libellés FR pour le sélecteur.
export const METRIC_LABELS: Record<Metric, string> = {
  score_valeur: "Score global",
  gap_pondere: "Écart qualité/prix",
  prix: "Prix au m²",
  prix_maison: "Prix maisons",
  prix_appart: "Prix appartements",
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

// Explications FR affichées derrière le « i » de chaque métrique dans la sidebar.
export const METRIC_INFO: Record<Metric, string> = {
  score_valeur:
    "Note globale de 0 à 1 agrégeant toutes les dimensions, pondérées par leur importance.",
  gap_pondere:
    "Écart entre la qualité du territoire et son prix. Positif = bon rapport qualité/prix, négatif = cher pour ce qu'offre la commune.",
  prix: "Prix de vente médian au m² (DVF, tous types de biens confondus).",
  prix_maison: "Prix de vente médian au m² des maisons (DVF).",
  prix_appart: "Prix de vente médian au m² des appartements (DVF).",
  n_transport:
    "Desserte en transports : densité d'arrêts et accès au réseau. Élevé = bien desservi.",
  n_securite:
    "Niveau de sécurité, à partir de la délinquance rapportée à la population. Élevé = plus sûr.",
  n_tourisme:
    "Attractivité touristique : sites, hébergements et fréquentation.",
  n_emploi: "Dynamisme de l'emploi et du bassin économique local.",
  n_risques:
    "Exposition aux risques naturels et technologiques (inondation, industriel…). Élevé = faible exposition.",
  n_dpe: "Performance énergétique moyenne du parc de logements (DPE). Élevé = plus économe.",
  n_services: "Présence de services et de commerces de proximité.",
  n_loisirs: "Offre de loisirs, culture et équipements sportifs.",
  n_ensoleillement: "Ensoleillement annuel de la commune.",
  n_proximite: "Proximité des pôles et des équipements du quotidien.",
  n_access_fin:
    "Accessibilité financière du logement au regard des revenus locaux. Élevé = plus abordable.",
  n_prix: "Niveau de prix de l'immobilier (normalisé). Élevé = plus abordable.",
}

// gap_pondere est centré sur 0 (peut être négatif) -> échelle divergente ; tout
// le reste est dans [0, 1] -> échelle séquentielle.
export const DIVERGING_METRICS: ReadonlySet<Metric> = new Set(["gap_pondere"])

// --- Anatomie du score (radar de la fiche commune) -----------------------------
// Les 9 dimensions PONDÉRÉES du score gold, ordonnées par poids décroissant :
// la forme du radar reflète la vraie composition du score. n_prix, n_access_fin
// et n_dpe sont calculées mais HORS score (contexte) — affichées à part.

export interface ComposanteDef {
  key: Dimension
  label: string
  poids: number | null // null = hors score
}

export const COMPOSANTES_PONDEREES: ComposanteDef[] = [
  { key: "n_emploi", label: METRIC_LABELS.n_emploi, poids: 0.3 },
  { key: "n_proximite", label: METRIC_LABELS.n_proximite, poids: 0.18 },
  { key: "n_transport", label: METRIC_LABELS.n_transport, poids: 0.15 },
  { key: "n_securite", label: METRIC_LABELS.n_securite, poids: 0.12 },
  { key: "n_services", label: METRIC_LABELS.n_services, poids: 0.12 },
  { key: "n_loisirs", label: METRIC_LABELS.n_loisirs, poids: 0.07 },
  { key: "n_ensoleillement", label: METRIC_LABELS.n_ensoleillement, poids: 0.04 },
  { key: "n_risques", label: METRIC_LABELS.n_risques, poids: 0.01 },
  { key: "n_tourisme", label: METRIC_LABELS.n_tourisme, poids: 0.01 },
]

export const COMPOSANTES_CONTEXTE: ComposanteDef[] = [
  { key: "n_prix", label: METRIC_LABELS.n_prix, poids: null },
  { key: "n_access_fin", label: METRIC_LABELS.n_access_fin, poids: null },
  { key: "n_dpe", label: METRIC_LABELS.n_dpe, poids: null },
]

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
  prix_maison?: NumOrNull
  prix_appart?: NumOrNull
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
// ~35k features × ~25 champs bloquerait le thread principal plusieurs secondes,
// et un seul enregistrement fautif ferait échouer TOUTE la carte. La source est
// notre propre export contrôlé : une propriété manquante dégrade en "no data"
// pour la commune concernée (getFillColor -> NO_DATA), pas en crash global.
const scoreEnvelope = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.unknown()),
})

// Properties de la choroplèthe communale (contrat pipeline) telles qu'on les
// adapte — décrites en TS, non validées (cf. commentaire enveloppe).
type ChoroplethRaw = {
  code_commune?: string
  nom?: string | null
  code_departement?: string | null
  prix_m2_median?: NumOrNull
  maison_prix_m2_median?: NumOrNull
  appart_prix_m2_median?: NumOrNull
  nb_transactions?: NumOrNull
  dpe_dominant?: string | null
  score_valeur?: NumOrNull
  gap?: NumOrNull
  gap_pondere?: NumOrNull
} & Partial<Record<(typeof DIMENSIONS)[number], NumOrNull>>

/**
 * Charge la choroplèthe communale du run courant (`base` de meta.json) et
 * adapte ses properties au format historique de la page (un seul fetch :
 * géométries + toutes les métriques, 34 928 communes — les non-scorées
 * rendent « no data » sur les métriques de score).
 */
export async function fetchScore(base: string): Promise<ScoreCollection> {
  const url = artifactUrl(base, "choropleth/communes-mid.geojson")
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`CDN ${url} -> ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  scoreEnvelope.parse(json) // vérifie type + features:[] sans parcourir chaque feature

  const collection = json as { features: { geometry: Geometry; properties: ChoroplethRaw }[] }
  const features: ScoreFeature[] = collection.features.map((f) => {
    const p = f.properties
    return {
      type: "Feature" as const,
      geometry: f.geometry,
      properties: {
        code_commune: p.code_commune ?? "",
        nom: p.nom ?? null,
        dep: p.code_departement ?? null,
        prix: p.prix_m2_median ?? null,
        prix_maison: p.maison_prix_m2_median ?? null,
        prix_appart: p.appart_prix_m2_median ?? null,
        nb_transactions: p.nb_transactions ?? null,
        dpe: p.dpe_dominant ?? null,
        score_valeur: p.score_valeur ?? null,
        gap: p.gap ?? null,
        gap_pondere: p.gap_pondere ?? null,
        ...(Object.fromEntries(
          DIMENSIONS.map((d) => [d, p[d] ?? null]),
        ) as Record<(typeof DIMENSIONS)[number], NumOrNull>),
      },
    }
  })
  return { type: "FeatureCollection", features }
}
