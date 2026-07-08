// États de chargement / d'erreur standardisés : un seul vocabulaire dans
// toute l'app (l'audit relevait 5 variantes de « Chargement… » et 3 messages
// d'erreur différents).

import { cn } from "@/lib/utils"

export function LoadingHint({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} role="status">
      Chargement…
    </p>
  )
}

export function ErrorHint({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-destructive", className)} role="alert">
      Données indisponibles — réessayez plus tard.
    </p>
  )
}
