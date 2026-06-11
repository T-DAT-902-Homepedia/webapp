# Faire des appels API dans la webapp

## Configuration

L'URL de l'API est définie par la variable d'environnement `VITE_API_URL`.
Les fichiers `.env.*` ne sont **jamais committés** — copier les exemples :

```bash
cp .env.development.example .env.development   # utilisé par `npm run dev`
cp .env.production.example .env.production     # utilisé par `npm run build`
```

> ⚠️ Les variables Vite sont **figées au moment du build** dans le bundle JS.
> Elles sont donc publiques (jamais de secret dedans) et changer l'URL
> nécessite de rebuilder.

## Le helper `apiUrl`

Tous les appels passent par `src/lib/api.ts`, qui centralise l'URL de base :

```ts
const API_URL = import.meta.env.VITE_API_URL

export function apiUrl(path: string) {
  return `${API_URL}${path}`
}
```

Ne jamais écrire d'URL d'API en dur (`http://localhost:3000/...`) dans un
composant — toujours passer par `apiUrl()`.

## Exemple : récupérer des données avec TanStack Query

Le projet utilise [TanStack Query](https://tanstack.com/query) pour la gestion
des données serveur (cache, loading, erreurs, refetch automatique).

```tsx
import { useQuery } from "@tanstack/react-query"
import { apiUrl } from "@/lib/api"

type Logement = {
  id: string
  titre: string
  ville: string
}

async function fetchLogements(): Promise<Logement[]> {
  const res = await fetch(apiUrl("/logements"))
  if (!res.ok) {
    throw new Error(`Erreur API ${res.status}`)
  }
  return res.json()
}

export function LogementsList() {
  const { data, isPending, error } = useQuery({
    queryKey: ["logements"],
    queryFn: fetchLogements,
  })

  if (isPending) return <p>Chargement…</p>
  if (error) return <p>Erreur : {error.message}</p>

  return (
    <ul>
      {data.map((l) => (
        <li key={l.id}>
          {l.titre} — {l.ville}
        </li>
      ))}
    </ul>
  )
}
```

Points importants :

- **`queryKey`** identifie la requête dans le cache. Si la requête dépend d'un
  paramètre, l'inclure : `queryKey: ["logements", ville]`.
- **Toujours vérifier `res.ok`** : `fetch` ne rejette pas sur un statut HTTP
  d'erreur (404, 500…), seulement sur une erreur réseau.
- Typer la réponse (`Promise<Logement[]>`) pour garder l'autocomplétion.

## Exemple : envoyer des données (POST)

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiUrl } from "@/lib/api"

async function createLogement(data: { titre: string; ville: string }) {
  const res = await fetch(apiUrl("/logements"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Erreur API ${res.status}`)
  return res.json()
}

export function useCreateLogement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createLogement,
    onSuccess: () => {
      // Invalide le cache pour rafraîchir la liste
      queryClient.invalidateQueries({ queryKey: ["logements"] })
    },
  })
}
```

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| `undefined/logements` dans l'URL appelée | `.env.development` manquant, ou serveur dev non redémarré après création du fichier |
| Erreur CORS en prod | Le back doit autoriser le domaine du front (`https://homepedia-webapp-cceb1.web.app`) |
| L'app en prod appelle encore `localhost` | `.env.production` absent au moment du `npm run build` → rebuilder |