import { useMemo, useState } from "react"
import { Dialog } from "radix-ui"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSearchIndex } from "@/hooks/useSearchIndex"
import { searchCommunes, type SearchEntry } from "@/lib/search"
import { formatEuroM2, formatScore } from "@/lib/format"
import { cn } from "@/lib/utils"

// Palette de recherche globale (Ctrl/Cmd+K) sur les 34 933 communes, en Radix
// Dialog : focus trap, role="dialog", Escape et restauration du focus fournis.
// Le contenu n'est monté qu'ouvert : l'état (saisie, curseur) repart de zéro à
// chaque ouverture sans effet de synchronisation.

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
    <>
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setCursor(0)
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
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
    </>
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
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content
          className="fixed inset-x-0 top-[15vh] z-50 mx-auto w-full max-w-lg overflow-hidden rounded-xl border bg-background shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Rechercher une commune</Dialog.Title>
          <SearchPanel onClose={onClose} onSelect={onSelect} placeholder={placeholder} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
