import * as React from "react"
import { ToggleGroup } from "radix-ui"

import { cn } from "@/lib/utils"

export interface SegmentedItem<T extends string> {
  value: T
  label: string
  /** Icône optionnelle (dimensionnée par le contrôle, ~14px). */
  icon?: React.ReactNode
  /** Info-bulle native — utile pour expliquer un terme (« Choroplèthe »). */
  title?: string
}

/**
 * Contrôle segmenté (choix exclusif, toujours une option active) basé sur
 * Radix ToggleGroup type="single" : sémantique radio (role, aria-checked)
 * et navigation clavier fournies par Radix.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  items,
  className,
  ...props
}: {
  value: T
  onValueChange: (value: T) => void
  items: SegmentedItem<T>[]
  /** Libellé accessible du groupe. */
  "aria-label": string
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Piège Radix : re-cliquer l'option active émet "" (désélection).
      // On l'ignore pour garantir qu'une option reste toujours sélectionnée.
      onValueChange={(v) => {
        if (v) onValueChange(v as T)
      }}
      data-slot="segmented-control"
      className={cn(
        "flex w-full items-center gap-0.5 rounded-lg border border-input bg-muted/60 p-0.5",
        className
      )}
      {...props}
    >
      {items.map((item) => (
        <ToggleGroup.Item
          key={item.value}
          value={item.value}
          title={item.title}
          className="inline-flex h-6 flex-1 items-center justify-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          {item.icon}
          {item.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
