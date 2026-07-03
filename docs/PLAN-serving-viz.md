# PLAN — Serving CDN statique + visualisations v1

**Public visé** : développeurs de la webapp, sans contexte préalable requis. Tout ce qu'il
faut savoir (contrat de données, architecture, découpage en PRs, critères d'acceptation)
est dans ce document.

**TL;DR** : l'API FastAPI est mise en pause — toutes les données sont désormais servies en
statique depuis un bucket GCS public, pré-générées par le pipeline data (une fois par an).
La webapp fetch directement le CDN. Six PRs ordonnées ci-dessous, la première rend la
carte de prod fonctionnelle.

---

## 0. Contexte et contrat de données

```
BASE = https://storage.googleapis.com/homepedia-web/v1
```

- `GET {BASE}/meta.json` — **seul fichier muté** (cache HTTP 5 min) :

```json
{
  "schema_version": 1,
  "run_date": "2026-07-02",
  "year": 2024,
  "base": "runs/2026-07-02",
  "nb_communes": 34933,
  "nb_communes_scorees": 17774,
  "generated_at": "2026-07-02T18:31:47+00:00"
}
```

- Tout le reste est sous `{BASE}/{meta.base}/…`, **immuable** (cache-control 1 an,
  `immutable`) :
  - `choropleth/departements-low.geojson` (~120 Ko gz), `choropleth/departements-mid.geojson` (~800 Ko gz)
  - `choropleth/communes-mid.geojson` (2,9 Mo gz, 34 928 features, national)
  - `choropleth/communes-high/{dept}.geojson` ×101 (`{dept}` ∈ 01…95, 2A, 2B, 971…976)
  - `communes/{dept}.json` ×101 (fiches commune, groupées par département)
  - `search/index.json` (~500 Ko gz), `classements/gap-pondere.json` (top 100)
- CORS : GET/HEAD ouverts. Gzip transparent (`content-encoding: gzip`), `fetch` le décode
  tout seul.

**Properties GeoJSON départements** : `code_departement`, `nom`, `prix_m2_median`
(nullable), `nb_transactions`, `fiable`, `maison_prix_m2_median` (nullable),
`maison_nb_transactions`, `maison_fiable`, `appart_prix_m2_median` (nullable),
`appart_nb_transactions`, `appart_fiable`.

**Properties GeoJSON communes** : les mêmes **plus** `code_commune`, `score_valeur`
(nullable), `gap_pondere` (nullable).

**Fiche commune** (élément du tableau `communes/{dept}.json`) :

```json
{
  "code_commune": "31555", "nom_commune": "Toulouse", "code_departement": "31",
  "prix": {"median": 3200.5, "p25": 2800.0, "p75": 3700.0, "moyen": 3300.1,
           "nb_transactions": 4200, "fiable": true,
           "maison": {"median": 3500.0, "nb_transactions": 1200},
           "appartement": {"median": 3100.0, "nb_transactions": 3000}},
  "evolution": [{"annee": 2021, "prix_m2_median": 3000.0, "nb_transactions": 4100},
                {"annee": 2022, "prix_m2_median": 3150.0, "nb_transactions": 4000},
                {"annee": 2024, "prix_m2_median": 3200.5, "nb_transactions": 4200}],
  "score": {"score_valeur": 0.61, "gap": 0.12, "gap_pondere": 0.05, "dpe_dominant": "D",
            "composantes": {"n_prix": 0.4, "n_transport": 0.8, "n_access_fin": 0.5,
                            "n_risques": 0.9, "n_tourisme": 0.1, "n_securite": 0.5,
                            "n_services": 0.7, "n_loisirs": 0.6, "n_ensoleillement": 0.7,
                            "n_emploi": 0.8, "n_proximite": 1.0, "n_dpe": 0.5}},
  "indicateurs": {"revenu_median": 24310.0, "taux_chomage": 9.2,
                  "taux_couverture_emploi": 1.2, "pop_active": 250000,
                  "densite_arrets_km2": 12.5, "nb_arrets": 1480,
                  "nb_services_sante": 3200, "nb_loisirs_culture": 800,
                  "taux_delinquance_global": 85.0, "insee_pop": 493465,
                  "part_residences_secondaires": 0.03, "nb_arretes_catnat": 12,
                  "ensoleillement_h_an": 2030.0, "temperature_moy_annuelle": 14.2,
                  "dist_metropole_km": 0.5, "nom_metropole": "Toulouse",
                  "surface_km2": 118.3}
}
```

`prix`, `evolution` et `score` sont **nullables au niveau bloc** ; toutes les feuilles
d'`indicateurs` sont nullables individuellement.

**`search/index.json`** : tableau de 34 933 entrées `{c: code, n: nom, d: dept, p: prix
médian entier|null, s: score|null}`.

**`classements/gap-pondere.json`** : top 100 `{rang, code_commune, nom_commune,
code_departement, prix_m2_median, score_valeur, gap_pondere}`.

### Sémantique métier

- `score_valeur` ∈ [0,1] : qualité de vie composite. Poids : **emploi 30 %, proximité
  métropole 18 %, transport 15 %, sécurité 12 %, services 12 %, loisirs 7 %,
  ensoleillement 4 %, risques 1 %, tourisme 1 %**. `n_prix`, `n_access_fin`, `n_dpe`
  sont calculés mais **hors score** (contexte).
- `gap_pondere` : « sous-cotation » — **élevé = commune sous-évaluée = opportunité**.
  Métrique **signée** autour de 0 (négatif = surcoté).
- `fiable` : au moins 5 transactions DVF — quand `false`, la valeur prix existe mais est
  statistiquement fragile (à atténuer visuellement, pas à cacher).

### Pièges connus (à gérer partout)

1. **Paris (75056), Lyon (69123), Marseille (13055) n'ont pas d'agrégat prix/évolution
   au niveau commune** : les transactions DVF sont codées par arrondissement (751xx,
   6938x, 132xx), qui sont eux des features/fiches normales.
2. **5 fiches sans géométrie** (communes fusionnées entre millésimes) : atteignables par
   recherche/fiche mais pas par la carte.
3. **Dérivation du département depuis un code commune** : 3 premiers caractères si
   préfixe « 97 », sinon 2 (gère naturellement 2A/2B : `"2A004".slice(0,2) === "2A"`).

---

## 1. Décisions transverses (tranchées)

| Question | Décision | Justification |
|---|---|---|
| `VITE_DATA_URL` absolu en dev ? | **Oui.** URL GCS en dur comme défaut dans le code, surchargée par `VITE_DATA_URL` si présent. Suppression du proxy Vite `/api`. | CORS ouvert ; un seul chemin de code dev/prod ; zéro `.env` requis pour démarrer. |
| `lib/api.ts` / `lib/dvf.ts` | **Supprimés.** Remplacés par `lib/data.ts` (plomberie) + un module par domaine (`choropleth.ts`, `commune.ts`, `search.ts`, `classement.ts`). | Un module par artefact = PRs parallélisables sans conflit. |
| Cache react-query | `meta` : `staleTime: 5 min`. Tous les artefacts : `staleTime: Infinity` + `meta.base` dans la `queryKey`. | Les artefacts sont immuables et versionnés par chemin ; un nouveau run change `base` donc les clés. |
| Palette score | Séquentielle **mono-teinte bleue** (ColorBrewer Blues, foncé = meilleur). | Magnitude = une teinte, clair→foncé. Cohérente avec l'accent de l'app. |
| Palette gap | **Divergente PRGn 7 classes** (violet = surcoté, neutre ≈ 0, vert = sous-coté/opportunité), domaine symétrique robuste. | Le gap est une polarité, pas une magnitude. PRGn est CVD-safe et ne collisionne ni avec le YlOrRd du prix ni avec le bleu du score. |
| Palette prix | YlOrRd existante conservée. | Chaleur sémantique admise, **à condition d'avoir une légende** (PR2). |
| Radar : composantes ? | **Les 9 pondérées uniquement**, ordonnées par poids décroissant. `n_prix`, `n_access_fin`, `n_dpe` à part en « Contexte (hors score) ». | La forme du radar doit représenter l'anatomie réelle du score. |
| Couleurs comparaison | Série A = `var(--chart-1)` (bleu), série B = `var(--chart-3)` (orange). | Paire chaud/froid = séparation CVD maximale ; tokens du thème → dark mode gratuit. |
| Vitest | **Oui, minimal** — voir §9. | La logique à risque est concentrée dans des fonctions pures testables sans DOM. |
| Défaut `typeLocal` | Devient `"tous"` (PR2). | La vue toutes-transactions est la plus représentative. |

**Perfs deck.gl (règles pour toutes les PRs carte)** :

- Ne jamais recréer une layer pour un changement de couleur : `id` stable, `getFillColor`
  qui délègue à une échelle mémoïsée, et `updateTriggers: { getFillColor: [colorScale] }`
  où `colorScale` change d'identité quand (data, metric, typeLocal) changent. Retirer
  `typeLocal` de l'`id` de layer (aujourd'hui il force une reconstruction complète).
- Les accessors passés à `GeoJsonLayer` doivent être mémoïsés (`useMemo`), jamais inline.
- La validation zod des 35k features (~100-200 ms) n'a lieu qu'une fois par session
  (react-query cache le résultat parsé) : acceptable, ne pas la désactiver.

Prérequis implicite de chaque PR : `npm run typecheck && npm run lint && npm run build`
verts.

---

## 2. PR1 — Bascule CDN

**Objectif** : la carte existante (prix/m², départements + communes) lit le bucket GCS au
lieu de l'API. Aucune nouvelle fonctionnalité. LOD `high` **clampé à `mid`** (le
chargement par département arrive en PR3). Cette PR rend la carte de prod fonctionnelle.

### Fichiers

| Action | Fichier |
|---|---|
| Créer | `src/lib/data.ts`, `src/lib/choropleth.ts`, `src/hooks/useMeta.ts` |
| Supprimer | `src/lib/api.ts`, `src/lib/dvf.ts` |
| Modifier | `src/hooks/useChoropleth.ts`, `src/lib/colorScale.ts`, `src/pages/dvf-map.tsx`, `src/store/filters.ts` (import de type), `vite.config.ts`, `.env.development.example`, `.env.production.example`, `docs/api-calls.md` → réécrit en `docs/data-cdn.md` |
| Créer | Vitest : devDependency + script `"test": "vitest run"` + `src/lib/choropleth.test.ts` |

### `src/lib/data.ts`

```ts
import { z } from "zod"

export const DATA_URL: string =
  import.meta.env.VITE_DATA_URL ?? "https://storage.googleapis.com/homepedia-web/v1"

export const metaSchema = z.object({
  schema_version: z.literal(1),
  run_date: z.string(),
  year: z.number(),
  base: z.string(),              // ex. "runs/2026-07-02"
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
```

### `src/hooks/useMeta.ts`

```ts
export function useMeta() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: fetchMeta,
    staleTime: 5 * 60 * 1000,   // aligné sur le cache HTTP du bucket
  })
}
```

Toutes les autres queries suivent le motif : `enabled: !!meta`, `queryKey` contenant
`meta.base`, `staleTime: Infinity`.

### `src/lib/choropleth.ts`

```ts
export type Lod = "low" | "mid" | "high"

export const choroplethPropertiesSchema = z.object({
  code_departement: z.string(),
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
  // Maille commune uniquement :
  code_commune: z.string().optional(),
  score_valeur: z.number().nullable().optional(),
  gap_pondere: z.number().nullable().optional(),
})
export type ChoroplethProperties = z.infer<typeof choroplethPropertiesSchema>
// feature / featureCollectionSchema : reprendre la structure actuelle de dvf.ts
// (geometry: z.any(), consommée telle quelle par deck.gl).

/** Mapping (mesh, lod) -> chemin d'artefact. PR1 : high communes clampé à mid. */
export function choroplethPath(mesh: Mesh, lod: Lod, codeDepartement?: string): string {
  if (mesh === "departements")
    return `choropleth/departements-${lod === "low" ? "low" : "mid"}.geojson`
  if (lod === "high" && codeDepartement)
    return `choropleth/communes-high/${codeDepartement}.geojson`   // utilisé à partir de PR3
  return `choropleth/communes-mid.geojson`
}

export function fetchChoropleth(
  base: string, mesh: Mesh, lod: Lod, codeDepartement?: string,
): Promise<ChoroplethFeatureCollection>

/** Stats du type de local courant, dérivées des properties préfixées. */
export type TypeLocal = "Maison" | "Appartement"   // PR2 le remplace par TypeLocalFilter
export function statsForType(p: ChoroplethProperties, t: TypeLocal): {
  prix: number | null; nb: number; fiable: boolean
}
```

**Point clé : `typeLocal` sort du fetch et de la `queryKey`.** Le GeoJSON contient les
trois familles de colonnes ; changer de type ne doit déclencher **aucun** refetch,
uniquement un recalcul de couleurs.

### `src/hooks/useChoropleth.ts` (réécriture)

```ts
export function useChoropleth(mesh: Mesh, lod: Lod) {
  const { data: meta } = useMeta()
  const effectiveLod: Lod =
    mesh === "communes" ? (lod === "high" ? "mid" : lod)      // clamp PR1
    : lod === "low" ? "low" : "mid"                            // départements : low|mid seulement
  return useQuery({
    queryKey: ["choropleth", meta?.base, mesh, effectiveLod],
    queryFn: () => fetchChoropleth(meta!.base, mesh, effectiveLod),
    enabled: !!meta,
    staleTime: Infinity,
  })
}
```

Le clamp vit dans le hook (pas dans `lodForZoom`) pour que la clé de cache ne produise
pas de doublons `mid`/`high` identiques.

### `src/lib/colorScale.ts`

Généralisation minimale (la paramétrisation complète par métrique arrive en PR2) :

```ts
export function makeColorScale(
  features: ChoroplethFeature[],
  getValue: (p: ChoroplethProperties) => number | null,
  getFiable: (p: ChoroplethProperties) => boolean,
): (f: ChoroplethFeature) => RGBA
```

Même palette YlOrRd, mêmes quantiles, mais l'atténuation « faible volume » utilise le
**`fiable` du type courant** (`maison_fiable`/`appart_fiable`).

### `src/pages/dvf-map.tsx`

- `useChoropleth(mesh, lod)` sans `typeLocal`.
- Accessors mémoïsés :

```ts
const getValue = useMemo(() => {
  const key = typeLocal === "Maison" ? "maison_prix_m2_median" as const : "appart_prix_m2_median" as const
  return (p: ChoroplethProperties) => p[key]
}, [typeLocal])
const getFiable = useMemo(() => { /* idem avec maison_fiable / appart_fiable */ }, [typeLocal])
const colorScale = useMemo(() => makeColorScale(data?.features ?? [], getValue, getFiable), [data, getValue, getFiable])
```

- Layer : `id: \`choropleth-${mesh}-${lod}\`` (sans `typeLocal`),
  `updateTriggers: { getFillColor: [colorScale] }`.
- Tooltip : utilise `statsForType(props, typeLocal)`.
- État d'erreur : si `useMeta()` échoue, bandeau « Impossible de charger les données »
  dans le panneau de contrôle, pas d'écran blanc.

### Config et docs

- `vite.config.ts` : supprimer le bloc `server.proxy` entier.
- `.env.*.example` : remplacer `VITE_API_URL` par
  `# VITE_DATA_URL=https://storage.googleapis.com/homepedia-web/v1` **commenté**
  (optionnel, le défaut est dans le code).
- `docs/api-calls.md` → `docs/data-cdn.md` : recopier le §0 de ce plan + le motif
  `useMeta`/`enabled`/`staleTime: Infinity`.

### Definition of done (manuelle)

1. `git grep -l "VITE_API_URL\|apiUrl\|lib/api"` ne retourne rien ; `src/lib/api.ts` et
   `src/lib/dvf.ts` n'existent plus.
2. `npm run dev` **sans aucun fichier `.env`** : la carte s'affiche. Network montre, dans
   l'ordre : `meta.json`, puis `departements-low.geojson` sous
   `storage.googleapis.com/homepedia-web/v1/runs/…`. Aucune requête vers `/api`.
3. Toggle Appartement ↔ Maison : la carte se recolore visiblement, **zéro nouvelle
   requête** réseau.
4. Zoom jusqu'à ≥ 8 : une seule requête `communes-mid.geojson` ; continuer à zoomer
   au-delà de 10 : **aucune** requête supplémentaire (high clampé).
5. Zoom avant/arrière répété : les fichiers déjà chargés ne sont jamais refetchés.
6. Tooltip sur un département et une commune : médiane du type courant formatée fr-FR,
   nb transactions, mention « faible volume » si le `fiable` du type est faux.
7. Survoler une commune sans donnée pour le type courant : polygone gris « no data »,
   tooltip « — ».

---

## 3. PR2 — Switcher de métrique + « Tous les types » + légende

**Objectif** : la carte affiche au choix prix (tous/maison/appartement), score ou gap,
avec palette adaptée, légende, et tooltip enrichi. Dépend de PR1.

### Fichiers

| Action | Fichier |
|---|---|
| Créer | `src/lib/metrics.ts`, `src/components/map-legend.tsx` |
| Modifier | `src/store/filters.ts`, `src/lib/colorScale.ts`, `src/lib/choropleth.ts` (`statsForType` élargi à `"tous"`), `src/pages/dvf-map.tsx` |

### `src/store/filters.ts`

```ts
export type Metric = "prix" | "score" | "gap"
export type TypeLocalFilter = "tous" | "maison" | "appartement"

interface FiltersState {
  metric: Metric
  typeLocal: TypeLocalFilter
  setMetric: (m: Metric) => void
  setTypeLocal: (t: TypeLocalFilter) => void
}
// défauts : metric "prix", typeLocal "tous"
```

### `src/lib/metrics.ts` — registre central

```ts
export interface MetricDef {
  id: Metric
  label: string                    // "Prix au m²" | "Qualité de vie" | "Sous-cotation"
  legendTitle: string
  kind: "sequential" | "diverging"
  palette: RGBA[]                  // 6 classes (seq) ou 7 classes (div, classe centrale neutre)
  communesOnly: boolean            // score/gap n'existent pas à la maille département
  getValue(p: ChoroplethProperties, t: TypeLocalFilter): number | null
  getFiable(p: ChoroplethProperties, t: TypeLocalFilter): boolean
  format(v: number): string        // tooltip + légende
}
export const METRICS: Record<Metric, MetricDef>
export const TYPE_PREFIX: Record<TypeLocalFilter, "" | "maison_" | "appart_"> =
  { tous: "", maison: "maison_", appartement: "appart_" }
```

**Palettes (valeurs exactes)** :

- `prix` : YlOrRd 6 classes existante. `format`: `"3 250 €/m²"`.
- `score` (séquentielle, **foncé = meilleur**) — ColorBrewer Blues 6 :
  `#eff3ff, #c6dbef, #9ecae1, #6baed6, #3182bd, #08519c`. `format`: score **× 100
  arrondi** → `"72 / 100"`.
- `gap` (divergente, **7 classes**, ColorBrewer PRGn) :
  `#762a83, #af8dc3, #e7d4e8, #f7f7f7, #d9f0d3, #7fbf7b, #1b7837` — violet = surcoté,
  neutre ≈ 0, vert = sous-coté. `format`: signe explicite, 2 décimales (`"+0,14"`).

`getValue` pour `prix` : `p[TYPE_PREFIX[t] + "prix_m2_median"]`. Pour `score`/`gap` :
`p.score_valeur ?? null` / `p.gap_pondere ?? null` (indépendants de `t`).

### `src/lib/colorScale.ts` (réécriture)

```ts
export interface ColorScaleBin { color: RGBA; from: number | null; to: number | null }
export interface ColorScale {
  getColor(f: ChoroplethFeature): RGBA   // gris NO_DATA si null, alpha 110 si !fiable
  bins: ColorScaleBin[]                  // pour la légende, bornes croissantes
}

export function makeColorScale(
  features: ChoroplethFeature[],
  metric: MetricDef,
  typeLocal: TypeLocalFilter,
): ColorScale
```

- `sequential` : quantiles à `palette.length` classes (logique actuelle généralisée).
- `diverging` : domaine **symétrique robuste** `m = quantile(|valeurs non nulles|, 0.98)` ;
  7 classes de largeur égale sur `[−m, +m]` (classe centrale = couleur neutre). Le
  quantile robuste évite qu'un outlier écrase la dynamique.

### `src/components/map-legend.tsx`

```ts
export function MapLegend(props: { title: string; scale: ColorScale; format: (v: number) => string })
```

Carte flottante bas-droite ; une ligne par bin (pastille 12 px + « de X à Y » fr-FR,
bornes extrêmes « < X » / « > Y ») ; deux lignes fixes : pastille grise « Pas de
donnée », pastille semi-transparente « Volume faible (atténué) ».

### `src/pages/dvf-map.tsx`

- Maille effective : `const mesh = METRICS[metric].communesOnly ? "communes" : meshForZoom(zoom)`.
  Score/gap chargent `communes-mid.geojson` (2,9 Mo, une fois) même au zoom 5.
- `colorScale = useMemo(() => makeColorScale(data?.features ?? [], METRICS[metric], typeLocal), [data, metric, typeLocal])`.
- Panneau : segmented control 3 boutons (Prix / Qualité de vie / Sous-cotation) ; le
  toggle type (**Tous / Appartement / Maison**) n'est rendu **que** si `metric === "prix"`.
- Tooltip commune : les 3 infos — prix du type courant, score (« 72 / 100 » ou « Non
  scoré »), gap signé. Département : prix uniquement.

### Definition of done

1. Les 3 métriques se sélectionnent ; en passer une → l'autre **ne déclenche aucun
   refetch** si le fichier est en cache, seule la couleur change.
2. « Qualité de vie » au zoom 5 : maille communes, palette bleue, foncé = scores élevés
   (vérifier au tooltip).
3. « Sous-cotation » : commune verte = gap positif au tooltip, violette = négatif,
   quasi-nulles = neutres.
4. Légende conforme à la métrique courante, bornes fr-FR, entrées « Pas de donnée » et
   « Volume faible » présentes.
5. Toggle de type visible uniquement pour « Prix » ; « Tous » ≠ « Maison » visiblement.
6. Communes non scorées (~17k) : gris « Pas de donnée » en score/gap, tooltip « Non scoré ».
7. Dark mode (touche `d`) : panneau, légende et tooltip lisibles.

---

## 4. PR3 — LOD high par départements visibles

**Objectif** : au zoom ≥ 10, charger les géométries fines `communes-high/{dept}.geojson`
des seuls départements visibles, avec fallback mid sans flash. Dépend de PR2.

### Fichiers

| Action | Fichier |
|---|---|
| Créer | `src/lib/bbox.ts`, `src/hooks/useCommunesHigh.ts`, `src/hooks/useDebouncedValue.ts` |
| Modifier | `src/pages/dvf-map.tsx` |

### `src/lib/bbox.ts` (fonctions pures)

```ts
export type Bbox = [minLng: number, minLat: number, maxLng: number, maxLat: number]
export function featureBbox(f: { geometry: unknown }): Bbox        // récursif Polygon/MultiPolygon
export function deptBboxes(fc: ChoroplethFeatureCollection): Map<string, Bbox>
export function bboxIntersects(a: Bbox, b: Bbox): boolean
```

### `src/hooks/useCommunesHigh.ts`

```ts
export const HIGH_ZOOM_THRESHOLD = 10        // ajustable à 9.5 après essai terrain
export const MAX_HIGH_DEPTS = 15             // garde-fou : au-delà, rester en mid

/** Départements dont la bbox intersecte le viewport. Source : departements-low
 *  (déjà en cache après la vue initiale). Résultat trié (identité stable). */
export function useVisibleDepartements(viewBounds: Bbox | null): string[]

export function useCommunesHigh(depts: string[], enabled: boolean): {
  features: ChoroplethFeature[]
  loadedDepts: ReadonlySet<string>
  isFetching: boolean
}
```

Implémentation : `useQueries` react-query v5 avec l'option **`combine`** ; chaque query
`queryKey: ["choropleth", meta?.base, "communes-high", d]`, `staleTime: Infinity`.

### `src/pages/dvf-map.tsx`

- Remplacer `useState(zoom)` par le `viewState` complet ; dériver les bounds via
  `new WebMercatorViewport(viewState).getBounds()` (`@deck.gl/core`). **Débouncer les
  bounds** (`useDebouncedValue(bounds, 200)`) ; le zoom reste non débouncé.
- Composition quand `mesh === "communes"` :
  1. **Layer mid** (nationale, dessous) — toujours rendue : fallback sans flash.
  2. **Layer high** (dessus) — si `zoom >= HIGH_ZOOM_THRESHOLD`, data = features
     fusionnées. L'overdraw mid/high est invisible et évite tout filtrage coûteux.
- **Cohérence des couleurs** : l'échelle est calculée **une seule fois sur les features
  de communes-mid national** et réutilisée par la layer high. Ne jamais recalculer des
  quantiles sur le sous-ensemble high.
- `id` stables : `"choropleth-communes-mid"` / `"choropleth-communes-high"`.

### Definition of done

1. Zoom ≥ 10 sur Lyon : Network montre uniquement `communes-high/69.geojson` + les
   limitrophes visibles — jamais les 101.
2. Pendant le chargement d'une tuile, la maille mid reste affichée (aucune zone
   blanche) ; à l'arrivée, contours visiblement plus fins.
3. Pan au zoom 10 : chaque nouveau département visible est fetché **une fois**.
4. Une même commune a la **même couleur** en mid et en high ; tooltip identique.
5. Zoom 10 sur Paris/petite couronne : chargement < 3 s, pan fluide.
6. Dézoom sous 10 : layer high disparaît sans erreur console ; sous 8, départements.
7. Corse : `2A.geojson` ; la Réunion : `974.geojson`.
8. Métrique score/gap au zoom ≥ 10 : le high fonctionne aussi.

---

## 5. PR4 — Fiche commune `/commune/:code`

**Objectif** : page fiche complète (header stats, radar du score, évolution des prix,
indicateurs), accessible par clic sur la carte. Introduit Recharts. Dépend de PR1
uniquement (**parallélisable avec PR2/PR3**).

### Dépendances

```
npm i recharts
npx shadcn@latest add chart separator
```

### Fichiers

| Action | Fichier |
|---|---|
| Créer | `src/lib/commune.ts`, `src/lib/score.ts`, `src/lib/format.ts`, `src/hooks/useFiche.ts` |
| Créer | `src/components/page-shell.tsx` (header commun : logo, nav, futur bouton recherche) |
| Créer | `src/components/fiche/commune-header.tsx`, `…/score-radar.tsx`, `…/evolution-chart.tsx`, `…/indicateurs-grid.tsx` |
| Créer | `src/pages/commune.tsx` |
| Modifier | `src/App.tsx` (route + `React.lazy` sur les pages hors carte), `src/pages/dvf-map.tsx` (clic → navigation) |

### `src/lib/commune.ts` — schémas zod (feuilles nullables par défense)

```ts
const prixTypeSchema = z.object({ median: z.number(), nb_transactions: z.number() })
const prixSchema = z.object({
  median: z.number(), p25: z.number(), p75: z.number(), moyen: z.number(),
  nb_transactions: z.number(), fiable: z.boolean(),
  maison: prixTypeSchema.nullable(), appartement: prixTypeSchema.nullable(),
})
const evolutionPointSchema = z.object({
  annee: z.number(), prix_m2_median: z.number(), nb_transactions: z.number(),
})
const composantesSchema = z.object({
  n_prix: z.number().nullable(), n_transport: z.number().nullable(),
  n_access_fin: z.number().nullable(), n_risques: z.number().nullable(),
  n_tourisme: z.number().nullable(), n_securite: z.number().nullable(),
  n_services: z.number().nullable(), n_loisirs: z.number().nullable(),
  n_ensoleillement: z.number().nullable(), n_emploi: z.number().nullable(),
  n_proximite: z.number().nullable(), n_dpe: z.number().nullable(),
})
const scoreSchema = z.object({
  score_valeur: z.number(), gap: z.number().nullable(), gap_pondere: z.number().nullable(),
  dpe_dominant: z.string().nullable(), composantes: composantesSchema,
})
const indicateursSchema = z.object({
  revenu_median: z.number().nullable(), taux_chomage: z.number().nullable(),
  taux_couverture_emploi: z.number().nullable(), pop_active: z.number().nullable(),
  densite_arrets_km2: z.number().nullable(), nb_arrets: z.number().nullable(),
  nb_services_sante: z.number().nullable(), nb_loisirs_culture: z.number().nullable(),
  taux_delinquance_global: z.number().nullable(), insee_pop: z.number().nullable(),
  part_residences_secondaires: z.number().nullable(), nb_arretes_catnat: z.number().nullable(),
  ensoleillement_h_an: z.number().nullable(), temperature_moy_annuelle: z.number().nullable(),
  dist_metropole_km: z.number().nullable(), nom_metropole: z.string().nullable(),
  surface_km2: z.number().nullable(),
})
export const ficheSchema = z.object({
  code_commune: z.string(), nom_commune: z.string(), code_departement: z.string(),
  prix: prixSchema.nullable(),
  evolution: z.array(evolutionPointSchema).nullable(),
  score: scoreSchema.nullable(),
  indicateurs: indicateursSchema,
})
export type Fiche = z.infer<typeof ficheSchema>
export type Composantes = z.infer<typeof composantesSchema>

/** "75101"→"75", "2A004"→"2A", "97411"→"974". */
export function deptFromCodeCommune(code: string): string {
  return code.startsWith("97") ? code.slice(0, 3) : code.slice(0, 2)
}
export function fetchCommunesDept(base: string, dept: string): Promise<Fiche[]>
```

### `src/hooks/useFiche.ts`

```ts
export function useFiche(codeCommune: string | undefined) {
  const { data: meta } = useMeta()
  const dept = codeCommune ? deptFromCodeCommune(codeCommune) : undefined
  return useQuery({
    queryKey: ["communes", meta?.base, dept],       // cache PARTAGÉ par département
    queryFn: () => fetchCommunesDept(meta!.base, dept!),
    enabled: !!meta && !!dept,
    staleTime: Infinity,
    select: (fiches) => fiches.find((f) => f.code_commune === codeCommune),
  })
}
```

`select` doit être **stable** (`useCallback` sur `codeCommune`). « Succès mais
`data === undefined` » = commune introuvable → écran dédié avec lien retour carte.

### `src/lib/score.ts`

```ts
export interface ComposanteDef { key: keyof Composantes; label: string; poids: number | null }
export const COMPOSANTES_PONDEREES: ComposanteDef[] = [
  { key: "n_emploi",         label: "Emploi",              poids: 0.30 },
  { key: "n_proximite",      label: "Proximité métropole", poids: 0.18 },
  { key: "n_transport",      label: "Transports",          poids: 0.15 },
  { key: "n_securite",       label: "Sécurité",            poids: 0.12 },
  { key: "n_services",       label: "Services",            poids: 0.12 },
  { key: "n_loisirs",        label: "Loisirs",             poids: 0.07 },
  { key: "n_ensoleillement", label: "Ensoleillement",      poids: 0.04 },
  { key: "n_risques",        label: "Risques",             poids: 0.01 },
  { key: "n_tourisme",       label: "Tourisme",            poids: 0.01 },
]
export const COMPOSANTES_CONTEXTE: ComposanteDef[] = [
  { key: "n_prix", label: "Prix", poids: null },
  { key: "n_access_fin", label: "Accessibilité financière", poids: null },
  { key: "n_dpe", label: "DPE", poids: null },
]
export const formatScore = (v: number) => `${Math.round(v * 100)} / 100`
```

### Composants fiche

```ts
// score-radar.tsx — multi-séries dès PR4 (réutilisé tel quel en PR6)
export interface RadarSerie { label: string; composantes: Composantes; colorVar: "--chart-1" | "--chart-3" }
export function ScoreRadar(props: { series: RadarSerie[] })
```

- Recharts `RadarChart` via `ChartContainer` shadcn ; **9 axes = COMPOSANTES_PONDEREES
  dans cet ordre** ; domaine radial fixe `[0, 1]` ; `fillOpacity` ≤ 0.2, trait 2 px ;
  composante `null` → 0 dans la donnée, tooltip « n.d. ». Sous le radar : les 3
  composantes « **Contexte (hors score)** » en jauges horizontales + badge
  `dpe_dominant` — étiquetées « n'entrent pas dans le score ».

```ts
// evolution-chart.tsx — multi-séries dès PR4
export interface EvolutionSerie { label: string; points: { annee: number; prix_m2_median: number; nb_transactions: number }[]; colorVar: string }
export function EvolutionChart(props: { series: EvolutionSerie[] })
```

- `LineChart` : X = années, Y = €/m² fr-FR, **un seul axe**, ligne 2 px, tooltip
  crosshair (prix + nb transactions), grille hairline pleine. `evolution === null` →
  placeholder : « Pas d'agrégat communal — pour Paris, Lyon et Marseille, consultez les
  fiches d'arrondissement. »

```ts
// indicateurs-grid.tsx
export function IndicateursGrid(props: { indicateurs: Fiche["indicateurs"] })
```

Groupes (Cards) : **Population** (insee_pop, surface_km2, part_residences_secondaires) ;
**Emploi & revenus** (revenu_median, taux_chomage, taux_couverture_emploi, pop_active) ;
**Transports** (nb_arrets, densite_arrets_km2, dist_metropole_km + nom_metropole) ;
**Services & loisirs** (nb_services_sante, nb_loisirs_culture) ; **Sécurité & risques**
(taux_delinquance_global, nb_arretes_catnat) ; **Climat** (ensoleillement_h_an,
temperature_moy_annuelle).

### `src/lib/format.ts`

```ts
export function formatEuro(v: number | null | undefined): string      // "3 250 €" | "—"
export function formatEuroM2(v: number | null | undefined): string    // "3 250 €/m²" | "—"
export function formatInt(v: number | null | undefined): string       // "34 933" | "—"
export function formatPercent(v: number | null | undefined, digits?: number): string
export function formatDecimal(v: number | null | undefined, digits?: number): string
```

Tout `null`/`undefined` → `"—"`. Locale `fr-FR` partout. Migrer le tooltip carte dessus.

### Navigation

- `commune-header.tsx` : nom + badge département + stat tiles (Prix médian — p25-p75 en
  sous-texte, Score, Sous-cotation signée, Nb transactions). Gère `prix === null` et
  `score === null`.
- Carte → fiche (`dvf-map.tsx`) :

```ts
onClick: (info) => {
  const code = (info.object as ChoroplethFeature | undefined)?.properties.code_commune
  if (code) navigate(`/commune/${code}`)
},
```

plus `getCursor: ({ isHovering }) => (isHovering ? "pointer" : "grab")`, et « Cliquer
pour ouvrir la fiche » dans le tooltip (maille communes uniquement).
- `App.tsx` : `React.lazy` + `<Suspense>` pour `commune.tsx` (Recharts ~100 Ko gz hors
  bundle carte).

### Definition of done

1. `/commune/31555` (Toulouse) : header complet, radar 9 axes en français ordonnés par
   poids, 3 jauges « hors score », courbe d'évolution, indicateurs formatés fr-FR.
2. `/commune/75056` (Paris) : rend sans erreur — prix « — », placeholder évolution avec
   mention arrondissements ; `/commune/75101` (Paris 1er) : fiche complète normale.
3. `/commune/2A004` (Ajaccio) et `/commune/97411` (Saint-Denis) : Network montre
   `communes/2A.json` et `communes/974.json`.
4. Deux fiches du même département : le `.json` n'est fetché qu'une fois.
5. `/commune/99999` : écran « Commune introuvable » + lien retour, pas de crash.
6. Commune sans score : section score remplacée par un message, le reste s'affiche.
7. Carte zoom ≥ 8 : curseur pointer au survol, clic → bonne fiche ; clic département : rien.
8. F5 sur `/commune/...` fonctionne ; dark mode : charts lisibles.

---

## 6. PR5 — Recherche + classement

**Objectif** : palette de recherche globale (Ctrl+K) sur les 34 933 communes, et page
`/classement` (top 100 sous-cotées). Dépend de PR4.

### Dépendances : `npx shadcn@latest add command dialog table`

### Fichiers

| Action | Fichier |
|---|---|
| Créer | `src/lib/search.ts`, `src/lib/classement.ts`, `src/hooks/useSearchIndex.ts` |
| Créer | `src/components/search-command.tsx`, `src/pages/classement.tsx` |
| Modifier | `src/App.tsx`, `src/components/page-shell.tsx`, `src/pages/dvf-map.tsx` (bouton recherche), `src/pages/landing.tsx` (lien Classement) |

### `src/lib/search.ts`

```ts
export const searchEntrySchema = z.object({
  c: z.string(),               // code commune
  n: z.string(),               // nom
  d: z.string(),               // département
  p: z.number().nullable(),    // prix médian
  s: z.number().nullable(),    // score
})
export type SearchEntry = z.infer<typeof searchEntrySchema>
export function fetchSearchIndex(base: string): Promise<SearchEntry[]>

/** NFD + suppression des diacritiques (̀-ͯ) + lowercase + trim. */
export function normalizeText(s: string): string

export interface PreparedIndex { entries: SearchEntry[]; normalized: string[] }
export function buildSearchIndex(entries: SearchEntry[]): PreparedIndex

/** Ranking : préfixe exact > mot-préfixe (après tiret/espace/apostrophe) > inclusion ;
 *  requête numérique (^\d|^2a|^2b) -> match sur préfixe de code commune/département.
 *  Scan linéaire (35k × startsWith < 5 ms). */
export function searchCommunes(index: PreparedIndex, query: string, limit = 20): SearchEntry[]
```

### `src/components/search-command.tsx`

- shadcn `CommandDialog` avec **`shouldFilter={false}`** (le filtrage cmdk interne ne
  doit pas tourner sur 35k items) ; items = `searchCommunes(...)` (≤ 20).
- Index **lazy** : fetché à la première ouverture (`enabled: open && !!meta`).
- Requête < 2 caractères → message d'aide.
- Ligne : nom + badge dept + prix + score (ou « — »).
- Raccourci global Ctrl/Cmd+K (même pattern de garde que `theme-provider.tsx`).

### `/classement`

```ts
export const classementEntrySchema = z.object({
  rang: z.number(), code_commune: z.string(), nom_commune: z.string(),
  code_departement: z.string(), prix_m2_median: z.number().nullable(),
  score_valeur: z.number(), gap_pondere: z.number(),
})
```

`PageShell` + carte d'intro (« communes dont la qualité de vie est élevée relativement à
leur prix ») + `Table` shadcn : Rang, Commune (lien fiche), Dépt, Prix €/m², Score,
Sous-cotation (colonnes numériques `tabular-nums`, alignées à droite). 100 lignes.

### Definition of done

1. Recherche au clic **et** au Ctrl+K depuis carte, fiche et classement ;
   `search/index.json` n'apparaît dans Network **qu'à la première ouverture**.
2. « epinay » trouve Épinay-sur-Seine ; « saint denis » trouve Saint-Denis (93) et (974) ;
   « 2A » liste des communes corses ; « 97411 » trouve Saint-Denis (974).
3. Sélection → navigation fiche, palette fermée.
4. < 2 caractères : aide ; aucun résultat : « Aucune commune trouvée ».
5. Frappe fluide (aucun lag perceptible).
6. `/classement` : 100 lignes triées, liens fiches, F5 OK, fr-FR, dark mode.
7. Navigation : landing → Classement, panneau carte → recherche, PageShell → Carte/Classement.

---

## 7. PR6 — Comparaison de deux communes

**Objectif** : `/comparer?a={code}&b={code}` — deux fiches côte à côte, radars
superposés, évolutions superposées, tableau d'indicateurs. Dépend de PR4 + PR5.

### Fichiers

| Action | Fichier |
|---|---|
| Créer | `src/pages/comparer.tsx`, `src/components/fiche/compare-table.tsx` |
| Modifier | `src/App.tsx`, `src/components/page-shell.tsx`, `src/pages/commune.tsx` (bouton « Comparer » → `/comparer?a={code}`) |

### `src/pages/comparer.tsx`

- **L'URL est la source de vérité** (`useSearchParams`) : partageable, back/forward OK.
- Deux emplacements (grille 2 colonnes, empilée en mobile). Emplacement vide → carte
  « Choisir une commune » ouvrant `SearchCommand` avec `onSelect` qui écrit `a`/`b` dans
  les params (pas de navigation).
- **Couleurs fixes par emplacement** : A = `var(--chart-1)` (bleu), B = `var(--chart-3)`
  (orange). La couleur suit l'emplacement, jamais l'ordre de chargement.
- Radar : `<ScoreRadar series={[serieA, serieB]} />` — 2 séries ⇒ **légende obligatoire**
  (pastille + nom) ; `fillOpacity` ≤ 0.15 ; commune sans score → série omise + note.
- Évolution : `<EvolutionChart series={[…A, …B]} />` — **un seul axe Y** (même unité),
  jamais de double axe.
- `compare-table.tsx` : Table 3 colonnes (Indicateur / A / B), groupes identiques à
  `IndicateursGrid`, **présentation neutre** (pas de vert/rouge « meilleur/pire » en v1).
- Cas limites : `a === b` → « Choisissez deux communes différentes » ; code invalide →
  traitement fiche introuvable, l'autre colonne reste fonctionnelle.

### Definition of done

1. `/comparer?a=69381&b=31555` : deux colonnes, radar 2 séries bleu/orange avec légende,
   évolutions superposées sur un axe, tableau complet.
2. La recherche met à jour l'URL ; back/forward restaure les états.
3. A et B dans le même département : un seul fetch `communes/{dept}.json`.
4. `/comparer?a=75056&b=13055` : pas de crash — notes à la place des évolutions.
5. Commune non scorée : radar mono-série + note nominative.
6. `/comparer` sans params : deux emplacements vides invitant à la recherche.
7. « Comparer » depuis une fiche pré-remplit `a` ; couleurs stables quand on remplace `b`.
8. Lisible en mobile et en dark mode.

---

## 8. Ordonnancement et dépendances

```
PR1 ──> PR2 ──> PR3
  └───> PR4 ──> PR5 ──> PR6
```

PR2/PR3 (piste carte) et PR4/PR5 (piste pages) sont **parallélisables** après PR1.

## 9. Vitest : oui, en version minimale

Ajouter **`vitest` seul** (pas de jsdom, pas de testing-library) dès PR1 :
`npm i -D vitest`, script `"test": "vitest run"`. Cible exclusive : les fonctions pures,
là où se concentrent les pièges du domaine :

- PR1 : `choroplethPath` (mapping mesh/lod, clamp), `statsForType`.
- PR2 : bins de `makeColorScale` (quantiles, domaine divergent symétrique, null → NO_DATA).
- PR3 : `featureBbox`/`bboxIntersects` (MultiPolygon).
- PR4 : `deptFromCodeCommune` (**75101→75, 2A004→2A, 2B033→2B, 97411→974, 97611→976**),
  formatters.
- PR5 : `normalizeText`, ranking de `searchCommunes`.

Toute la vérification UI reste manuelle via les DoD (pas de tests de composants en v1).

## 10. Notes infra

- Le CORS du bucket est ouvert (`*`, GET/HEAD uniquement, données opendata publiques) :
  les previews Firebase de PR (`…--pr<N>-<hash>.web.app`) et `npm run preview`
  fonctionnent sans configuration.
- Les données sont regénérées une fois par an par le pipeline (`run_date` change dans
  `meta.json`, tous les chemins d'artefacts changent → les caches s'invalident seuls).
- Contrat de données produit par le repo `pipelines` (`duckpipe/src/duckpipe/export_web.py`) ;
  toute évolution du contrat se fait là-bas et incrémente `schema_version`.
