import { Dialog } from "radix-ui"
import { Link } from "react-router-dom"
import { ArrowRight, X } from "lucide-react"

import { WordCloud } from "@/components/avis/word-cloud"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAvis } from "@/hooks/useAvis"
import { formatSigned } from "@/lib/format"
import { cn } from "@/lib/utils"

// Nuage de mots d'une ville depuis la carte : Radix Dialog (focus trap,
// Escape, aria) aux tokens du thème, alimenté par les artefacts avis/ du CDN
// et rendu par le même composant WordCloud que la fiche commune — une seule
// implémentation, une seule palette (sentiment PRGn).

export default function WordCloudPopup({
  code,
  nom,
  onClose,
}: {
  code: string
  nom: string
  onClose: () => void
}) {
  const { data: avis, isLoading } = useAvis(code)
  const sentiment = avis?.sentiment_global

  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 text-foreground shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-lg font-bold tracking-tight">
                {nom} — ce qu'en disent les habitants
              </Dialog.Title>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {avis && <span>{avis.n_avis} avis · {avis.source ?? "Ville-idéale"}</span>}
                {sentiment != null && (
                  <Badge
                    variant="outline"
                    className={cn(
                      sentiment >= 0.15 &&
                        "border-[#1b7837]/40 text-[#1b7837] dark:text-[#7fbf7b]",
                      sentiment <= -0.15 &&
                        "border-[#762a83]/40 text-[#762a83] dark:text-[#af8dc3]",
                    )}
                  >
                    Sentiment {formatSigned(sentiment)}
                  </Badge>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fermer">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-3">
            {isLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Chargement des avis…
              </p>
            ) : avis?.wordcloud?.length ? (
              <WordCloud words={avis.wordcloud} activeTheme={null} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Pas assez de texte exploitable pour cette ville.
              </p>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/commune/${code}`}>
                Fiche complète (thèmes, verbatims)
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
