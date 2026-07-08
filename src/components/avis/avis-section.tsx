import { useState } from "react"

import { WordCloud } from "@/components/avis/word-cloud"
import { SentimentBars } from "@/components/avis/sentiment-bars"
import { VerbatimsList } from "@/components/avis/verbatims-list"
import { Badge } from "@/components/ui/badge"
import { useAvis } from "@/hooks/useAvis"
import { AVIS_THEMES, themeLabel } from "@/lib/avis"
import { formatSigned } from "@/lib/format"
import { cn } from "@/lib/utils"

// Section « Ce qu'en disent les habitants » de la fiche commune : nuage de
// mots + baromètre par thème + verbatims, tous pilotés par le même filtre de
// thème. Auto-masquée si la commune n'est pas couverte (ou run sans avis).

export function AvisSection({ codeCommune }: { codeCommune: string }) {
  const { data: avis } = useAvis(codeCommune)
  const [activeTheme, setActiveTheme] = useState<string | null>(null)
  const [highlightWord, setHighlightWord] = useState<string | null>(null)

  if (!avis) return null

  const sentiment = avis.sentiment_global
  const annees =
    avis.periode.debut && avis.periode.fin
      ? `${avis.periode.debut.slice(0, 4)}–${avis.periode.fin.slice(0, 4)}`
      : null

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Ce qu'en disent les habitants
        </h2>
        <span className="text-xs text-muted-foreground">
          {avis.n_avis} avis {annees && `(${annees})`} · {avis.source ?? "Ville-idéale"}
        </span>
        {sentiment != null && (
          <Badge
            variant="outline"
            className={cn(
              sentiment >= 0.15 && "border-[#1b7837]/40 text-[#1b7837] dark:text-[#7fbf7b]",
              sentiment <= -0.15 && "border-[#762a83]/40 text-[#762a83] dark:text-[#af8dc3]",
            )}
          >
            Sentiment {formatSigned(sentiment)}
          </Badge>
        )}
        {avis.low_data && (
          <Badge variant="outline" className="text-muted-foreground">
            Échantillon faible ({avis.n_avis} avis)
          </Badge>
        )}
      </div>

      {/* Filtre de thème partagé nuage/verbatims — « Sécurité » répond
          littéralement à l'exigence « word cloud sur la sécurité ». */}
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => {
            setActiveTheme(null)
            setHighlightWord(null)
          }}
          className={cn(
            "rounded-md border px-2 py-1 transition-colors",
            activeTheme === null
              ? "border-accent bg-accent/10 font-semibold text-accent"
              : "border-input text-muted-foreground hover:bg-muted",
          )}
        >
          Tous les thèmes
        </button>
        {AVIS_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveTheme(activeTheme === t.id ? null : t.id)
              setHighlightWord(null)
            }}
            className={cn(
              "rounded-md border px-2 py-1 transition-colors",
              activeTheme === t.id
                ? "border-accent bg-accent/10 font-semibold text-accent"
                : "border-input text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Nuage de mots {activeTheme && `— ${themeLabel(activeTheme)}`}
          </h3>
          {avis.wordcloud?.length ? (
            <WordCloud
              words={avis.wordcloud}
              activeTheme={activeTheme}
              onWordClick={(w) => setHighlightWord(highlightWord === w ? null : w)}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Pas assez de texte exploitable.
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Sentiment par thème
          </h3>
          {avis.themes?.length ? (
            <SentimentBars
              themes={avis.themes}
              activeTheme={activeTheme}
              onThemeClick={setActiveTheme}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {avis.low_data
                ? "Trop peu d'avis pour un sentiment par thème fiable."
                : "Pas de segments thématisés."}
            </p>
          )}
        </div>
      </div>

      {avis.verbatims?.length ? (
        <div className="mt-3 rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Extraits d'avis
            {highlightWord && ` — mot « ${highlightWord} »`}
          </h3>
          <VerbatimsList
            verbatims={avis.verbatims}
            activeTheme={activeTheme}
            highlightWord={highlightWord}
          />
        </div>
      ) : null}
    </section>
  )
}
