import { cn } from "@/lib/utils"

/**
 * Bloc tricolore de la marque : trois bandes verticales bleu/blanc/rouge
 * cerclées d'une hairline (sans elle, la bande blanche disparaît sur le fond
 * paper). Dimensionné en em : suit le corps du texte parent, pas de prop de
 * taille. Purement décoratif — le rouge est ici un accent de marque, jamais
 * un état ni une donnée (cf. doctrine --brand-red, index.css).
 */
export function TricolorMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 self-center overflow-hidden rounded-[0.15em] ring-1 ring-border",
        className,
      )}
    >
      <span className="h-[0.65em] w-[0.28em] bg-accent" />
      <span className="h-[0.65em] w-[0.28em] bg-white dark:bg-paper" />
      <span className="h-[0.65em] w-[0.28em] bg-brand-red" />
    </span>
  )
}
