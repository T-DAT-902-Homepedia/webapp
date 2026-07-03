# Données : CDN statique GCS

L'API FastAPI est en pause — toutes les données sont servies en statique depuis un
bucket GCS public, pré-générées par le pipeline data (une fois par an). La webapp
fetch directement le CDN, en dev comme en prod (CORS ouvert, aucun `.env` requis).

## Contrat de données

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
- CORS : GET/HEAD ouverts. Gzip transparent (`content-encoding: gzip`), `fetch` le
  décode tout seul.

**Properties GeoJSON départements** : `code_departement`, `nom`, `prix_m2_median`
(nullable), `nb_transactions`, `fiable`, `maison_prix_m2_median` (nullable),
`maison_nb_transactions`, `maison_fiable`, `appart_prix_m2_median` (nullable),
`appart_nb_transactions`, `appart_fiable`.

**Properties GeoJSON communes** : les mêmes **plus** `code_commune`, `score_valeur`
(nullable), `gap_pondere` (nullable).

## Sémantique métier

- `score_valeur` ∈ [0,1] : qualité de vie composite. Poids : **emploi 30 %, proximité
  métropole 18 %, transport 15 %, sécurité 12 %, services 12 %, loisirs 7 %,
  ensoleillement 4 %, risques 1 %, tourisme 1 %**. `n_prix`, `n_access_fin`, `n_dpe`
  sont calculés mais **hors score** (contexte).
- `gap_pondere` : « sous-cotation » — **élevé = commune sous-évaluée = opportunité**.
  Métrique **signée** autour de 0 (négatif = surcoté).
- `fiable` : au moins 5 transactions DVF — quand `false`, la valeur prix existe mais est
  statistiquement fragile (à atténuer visuellement, pas à cacher).

## Pièges connus (à gérer partout)

1. **Paris (75056), Lyon (69123), Marseille (13055) n'ont pas d'agrégat prix/évolution
   au niveau commune** : les transactions DVF sont codées par arrondissement (751xx,
   6938x, 132xx), qui sont eux des features/fiches normales.
2. **5 fiches sans géométrie** (communes fusionnées entre millésimes) : atteignables par
   recherche/fiche mais pas par la carte.
3. **Dérivation du département depuis un code commune** : 3 premiers caractères si
   préfixe « 97 », sinon 2 (gère naturellement 2A/2B : `"2A004".slice(0,2) === "2A"`).
4. **Certaines géométries sont des `GeometryCollection`** (polygone réel + LineString
   parasites issus de la simplification — 26/109 départements en low). deck.gl ne les
   rend pas : `normalizeGeometry` (`src/lib/choropleth.ts`) les réduit en MultiPolygon
   après chaque fetch. À corriger idéalement côté pipeline (`export_web.py`).

## Motif react-query

`src/hooks/useMeta.ts` charge `meta.json` (`staleTime: 5 min`, aligné sur le cache
HTTP du bucket). Toutes les autres queries suivent le motif :

```ts
const { data: meta } = useMeta()
return useQuery({
  queryKey: ["mon-artefact", meta?.base /* , …params */],
  queryFn: () => fetchJson(artifactUrl(meta!.base, "chemin/artefact.json"), schema),
  enabled: !!meta,
  staleTime: Infinity, // artefacts immuables, versionnés par chemin
})
```

Un nouveau run du pipeline change `meta.base`, donc toutes les clés de cache — les
caches (react-query et HTTP) s'invalident seuls. Plomberie dans `src/lib/data.ts`
(`fetchJson`, `artifactUrl`), domaine choroplèthe dans `src/lib/choropleth.ts`.
