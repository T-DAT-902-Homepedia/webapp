import { useMemo, useState } from "react"

import { themeLabel, type AvisVerbatim } from "@/lib/avis"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Verbatims d'avis filtrables (thème via la section parente, polarité ici).
// Extraits déjà anonymisés et échantillonnés par le pipeline.

const LABELS = ["Positif", "Négatif", "Nuancé"] as const

const LABEL_STYLES: Record<string, string> = {
  Positif: "border-transparent bg-[#1b7837]/15 text-[#1b7837] dark:text-[#7fbf7b]",
  Négatif: "border-transparent bg-[#762a83]/15 text-[#762a83] dark:text-[#af8dc3]",
  Nuancé: "border-transparent bg-muted text-muted-foreground",
}

export function VerbatimsList({
  verbatims,
  activeTheme,
  highlightWord,
}: {
  verbatims: AvisVerbatim[]
  activeTheme: string | null
  /** Mot cliqué dans le nuage : surligne les verbatims qui le contiennent. */
  highlightWord: string | null
}) {
  const [label, setLabel] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let rows = verbatims
    if (activeTheme) rows = rows.filter((v) => v.theme === activeTheme)
    if (label) rows = rows.filter((v) => v.label === label)
    if (highlightWord) {
      const needle = highlightWord.toLowerCase()
      const matching = rows.filter((v) => v.text.toLowerCase().includes(needle))
      if (matching.length > 0) rows = matching
    }
    return rows.slice(0, 12)
  }, [verbatims, activeTheme, label, highlightWord])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => setLabel(null)}
          className={cn(
            "rounded-md border px-2 py-1 transition-colors",
            label === null
              ? "border-accent bg-accent/10 font-semibold text-accent"
              : "border-input text-muted-foreground hover:bg-muted",
          )}
        >
          Tous
        </button>
        {LABELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLabel(label === l ? null : l)}
            className={cn(
              "rounded-md border px-2 py-1 transition-colors",
              label === l
                ? "border-accent bg-accent/10 font-semibold text-accent"
                : "border-input text-muted-foreground hover:bg-muted",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucun extrait pour ces filtres.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((v, i) => (
            <li key={i} className="rounded-lg border bg-background/50 p-3 text-sm">
              <p className="leading-relaxed">« {v.text} »</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge className={LABEL_STYLES[v.label] ?? LABEL_STYLES["Nuancé"]}>
                  {v.label}
                </Badge>
                {v.theme && <span>{themeLabel(v.theme)}</span>}
                {v.mois && <span>· {v.mois}</span>}
                {v.source && <span>· {v.source}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
