import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSearchIndex } from "@/hooks/useSearchIndex"
import { searchCommunes, type SearchEntry } from "@/lib/search"
import { formatEuroM2, formatScore } from "@/lib/format"
import { cn } from "@/lib/utils"

// Palette de recherche globale (Ctrl/Cmd+K) sur les 34 933 communes. Fait
// main (overlay + input + navigation clavier) : cohérent avec le style du
// repo (radar, sparkline) et évite une dépendance cmdk pour une seule liste.

export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onOpen} className="gap-2">
      <Search className="size-4" />
      <span className="hidden sm:inline">Rechercher une commune</span>
      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        Ctrl K
      </kbd>
    </Button>
  )
}

/** Contenu monté uniquement quand la palette est ouverte : l'état (saisie,
 *  curseur) se réinitialise par démontage, sans effet de synchronisation. */
function SearchPanel({
  onClose,
  onSelect,
  placeholder,
}: {
  onClose: () => void
  onSelect: (entry: SearchEntry) => void
  placeholder: string
}) {
  const [query, setQuery] = useState("")
  const [cursor, setCursor] = useState(0)
  const { data: index, isLoading } = useSearchIndex(true)

  const results = useMemo(
    () => (index ? searchCommunes(index, query) : []),
    [index, query],
  )
  const active = Math.min(cursor, Math.max(0, results.length - 1))

  const pick = (entry: SearchEntry | undefined) => {
    if (!entry) return
    onSelect(entry)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCursor(0)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose()
            else if (e.key === "ArrowDown") {
              e.preventDefault()
              setCursor(Math.min(active + 1, results.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setCursor(Math.max(active - 1, 0))
            } else if (e.key === "Enter") {
              e.preventDefault()
              pick(results[active])
            }
          }}
          placeholder={placeholder}
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="max-h-80 overflow-y-auto p-1.5">
          {isLoading && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Chargement de l'index…
            </p>
          )}
          {!isLoading && query.trim().length < 2 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Tapez au moins 2 caractères — nom (« Épinay »), code INSEE
              (« 97411 ») ou département (« 2A »).
            </p>
          )}
          {!isLoading && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucune commune trouvée.
            </p>
          )}
          {results.map((r, i) => (
            <button
              key={r.c}
              type="button"
              onClick={() => pick(r)}
              onMouseEnter={() => setCursor(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                i === active ? "bg-muted" : "hover:bg-muted/60",
              )}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{r.n}</span>
              <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {r.d}
              </span>
              <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                {r.p != null ? formatEuroM2(r.p) : "—"}
              </span>
              <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                {r.s != null ? formatScore(r.s) : "—"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SearchCommand({
  open,
  onClose,
  onSelect,
  placeholder = "Nom de commune, code INSEE ou département…",
}: {
  open: boolean
  onClose: () => void
  onSelect: (entry: SearchEntry) => void
  placeholder?: string
}) {
  if (!open) return null
  return <SearchPanel onClose={onClose} onSelect={onSelect} placeholder={placeholder} />
}
