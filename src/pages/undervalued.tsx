import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fetchScore, type ScoreProperties } from "@/lib/score"

// Le livrable actionnable de la problématique (#34) : classement des communes
// « sous-cotées » — gap_pondere positif = bien notée pour son prix. V1 sans
// sparklines (série temporelle des prix : dépend de la couche data #17).

type SortKey = "nom" | "dep" | "prix" | "score_valeur" | "gap_pondere"

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "nom", label: "Commune" },
  { key: "dep", label: "Dép." },
  { key: "prix", label: "€/m²", numeric: true },
  { key: "score_valeur", label: "Score global", numeric: true },
  { key: "gap_pondere", label: "Écart qualité/prix", numeric: true },
]

// Pagination d'affichage : 17 769 communes rendues d'un coup feraient ramer le DOM.
const PAGE = 100

function compare(a: ScoreProperties, b: ScoreProperties, key: SortKey): number {
  const va = a[key]
  const vb = b[key]
  // Les valeurs manquantes vont toujours en fin de liste, quel que soit le sens.
  if (va == null) return vb == null ? 0 : 1
  if (vb == null) return -1
  if (typeof va === "string" || typeof vb === "string")
    return String(va).localeCompare(String(vb), "fr")
  return va - vb
}

export default function Undervalued() {
  const [sortKey, setSortKey] = useState<SortKey>("gap_pondere")
  const [desc, setDesc] = useState(true)
  const [dep, setDep] = useState("")
  const [limit, setLimit] = useState(PAGE)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["score"], // même cache que la carte : pas de re-téléchargement.
    queryFn: fetchScore,
    staleTime: Infinity,
  })

  // Seules les communes notées ET pricées sont classables.
  const rows = useMemo(
    () =>
      (data?.features ?? [])
        .map((f) => f.properties)
        .filter((p) => p.gap_pondere != null && p.prix != null),
    [data],
  )

  const deps = useMemo(
    () =>
      [...new Set(rows.map((p) => p.dep).filter((d): d is string => d != null))].sort(
        (a, b) => a.localeCompare(b, "fr", { numeric: true }),
      ),
    [rows],
  )

  const sorted = useMemo(() => {
    const filtered = dep ? rows.filter((p) => p.dep === dep) : rows
    const s = [...filtered].sort((a, b) => compare(a, b, sortKey))
    return desc ? s.reverse() : s
  }, [rows, dep, sortKey, desc])

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setDesc(!desc)
    } else {
      setSortKey(key)
      // Par défaut : décroissant pour les colonnes numériques, croissant sinon.
      setDesc(COLUMNS.find((c) => c.key === key)?.numeric ?? false)
    }
    setLimit(PAGE)
  }

  const visible = sorted.slice(0, limit)

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Retour à l'accueil">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <span className="font-display text-lg font-bold tracking-tight">
            Homepedia<span className="text-accent">.</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Communes sous-cotées
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          L'écart qualité/prix compare la qualité du territoire (transport,
          sécurité, climat, services…) à son niveau de prix.{" "}
          <span className="font-medium text-foreground">
            Positif = sous-cotée
          </span>{" "}
          : la commune offre plus que ce que son prix suggère. Négatif = chère
          pour ce qu'elle offre.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Département
            <select
              value={dep}
              onChange={(e) => {
                setDep(e.target.value)
                setLimit(PAGE)
              }}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">Tous</option>
              {deps.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-muted-foreground">
            {sorted.length.toLocaleString("fr-FR")} communes classées
          </span>
        </div>

        {isLoading && (
          <div className="mt-8 text-sm text-muted-foreground">Chargement…</div>
        )}
        {isError && (
          <div className="mt-8 text-sm text-destructive">
            Données indisponibles
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2.5 font-semibold text-muted-foreground">
                      #
                    </th>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className={cn("px-3 py-2.5", c.numeric && "text-right")}
                      >
                        <button
                          type="button"
                          onClick={() => onSort(c.key)}
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold transition-colors hover:text-accent",
                            sortKey === c.key
                              ? "text-accent"
                              : "text-muted-foreground",
                          )}
                        >
                          {c.label}
                          {sortKey === c.key &&
                            (desc ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronUp className="size-3.5" />
                            ))}
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p, i) => (
                    <tr
                      key={p.code_commune}
                      className="border-b last:border-b-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">
                          {p.nom ?? p.code_commune}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.code_commune}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.dep ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {p.prix != null
                          ? Math.round(p.prix).toLocaleString("fr-FR")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {p.score_valeur?.toFixed(2) ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          (p.gap_pondere ?? 0) > 0
                            ? "text-accent"
                            : "text-destructive",
                        )}
                      >
                        {(p.gap_pondere ?? 0) >= 0 ? "+" : ""}
                        {p.gap_pondere?.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/map?commune=${p.code_commune}`}>
                            Carte
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {limit < sorted.length && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setLimit(limit + PAGE)}
                >
                  Afficher plus ({(sorted.length - limit).toLocaleString("fr-FR")}{" "}
                  restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
