import { Accordion, Checkbox, Slider, Tooltip } from "radix-ui"
import { ArrowLeft, Check, ChevronDown, Info } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  METRIC_INFO,
  METRIC_LABELS,
  type Metric,
} from "@/lib/score"
import { DIV_LEGEND, SEQ_LEGEND } from "@/lib/scoreColors"

export type Basemap = "clair" | "sombre" | "satellite" | "couleur"
export const BASEMAP_LABELS: Record<Basemap, string> = {
  clair: "Clair",
  sombre: "Sombre",
  satellite: "Satellite",
  couleur: "Couleur",
}
const BASEMAP_KEYS = Object.keys(BASEMAP_LABELS) as Basemap[]

export type MapView = { center: [number, number]; zoom: number }

// Points de recentrage : France métropolitaine + les 5 DROM (éloignés, non
// visibles au zoom métropole -> on y accède par flyTo).
const CENTERS: { label: string; view: MapView }[] = [
  { label: "France métropolitaine", view: { center: [2.4, 46.6], zoom: 5 } },
  { label: "Guadeloupe", view: { center: [-61.55, 16.2], zoom: 9 } },
  { label: "Martinique", view: { center: [-61.02, 14.64], zoom: 9 } },
  { label: "Guyane", view: { center: [-53.2, 3.9], zoom: 7 } },
  { label: "La Réunion", view: { center: [55.53, -21.13], zoom: 9 } },
  { label: "Mayotte", view: { center: [45.16, -12.83], zoom: 10 } },
]

type ScoreSidebarProps = {
  metrics: Metric[]
  metric: Metric
  onMetric: (m: Metric) => void
  diverging: boolean
  opacity: number
  onOpacity: (v: number) => void
  basemap: Basemap
  onBasemap: (b: Basemap) => void
  onCenter: (view: MapView) => void
  isLoading: boolean
  isError: boolean
  wordCloudEnabled: boolean
  onWordCloudEnabled: (v: boolean) => void
}

/** Bulle d'aide « i » réutilisée sur chaque métrique et titre de section. */
function InfoTip({ text, label }: { text: string; label: string }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={`À propos : ${label}`}
          className="shrink-0 rounded-full p-0.5 text-muted-foreground/70 transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="size-3.5" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-w-56 rounded-lg border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {text}
          <Tooltip.Arrow className="fill-popover" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

function AccordionSection({
  value,
  title,
  children,
}: {
  value: string
  title: string
  children: React.ReactNode
}) {
  return (
    <Accordion.Item value={value} className="border-b">
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center justify-between py-3 text-sm font-semibold transition-colors hover:text-accent">
          {title}
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="pb-4">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  )
}

export function ScoreSidebar({
  metrics,
  metric,
  onMetric,
  diverging,
  opacity,
  onOpacity,
  basemap,
  onBasemap,
  onCenter,
  isLoading,
  isError,
  wordCloudEnabled,
  onWordCloudEnabled,
}: ScoreSidebarProps) {
  const legend = diverging ? DIV_LEGEND : SEQ_LEGEND

  return (
    <Tooltip.Provider>
      <aside className="flex h-svh w-80 shrink-0 flex-col overflow-y-auto border-r bg-card text-card-foreground">
        {/* En-tête */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Retour à l'accueil">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <span className="font-display text-lg font-bold tracking-tight">
            Homepedia<span className="text-accent">.</span>
          </span>
        </div>

        {/* Sélecteur de métrique : une ligne par catégorie, avec son « i ». */}
        <div className="px-4 py-3">
          <div className="text-sm font-semibold">Score territoire</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choisissez la métrique à cartographier.
          </p>
          <div className="mt-2 space-y-0.5">
            {metrics.map((m) => {
              const active = m === metric
              return (
                <div
                  key={m}
                  className={cn(
                    "flex items-center gap-1 rounded-md pr-1.5 transition-colors",
                    active ? "bg-secondary" : "hover:bg-muted",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onMetric(m)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      active
                        ? "font-medium text-accent"
                        : "text-foreground/80",
                    )}
                  >
                    {METRIC_LABELS[m]}
                  </button>
                  <InfoTip text={METRIC_INFO[m]} label={METRIC_LABELS[m]} />
                </div>
              )
            })}
          </div>

          {/* Légende du dégradé */}
          <div className="mt-3">
            <div className="flex h-2 overflow-hidden rounded-sm">
              {legend.map((c, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{ backgroundColor: `rgb(${c[0]},${c[1]},${c[2]})` }}
                />
              ))}
            </div>
            <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
              {diverging ? (
                <>
                  <span>Cher</span>
                  <span>Neutre</span>
                  <span>Bon rapport</span>
                </>
              ) : (
                <>
                  <span>Faible</span>
                  <span>Élevé</span>
                </>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
          )}
          {isError && (
            <div className="mt-2 text-xs text-destructive">
              Données indisponibles
            </div>
          )}
        </div>

        {/* Paramètres d'affichage */}
        <Accordion.Root
          type="multiple"
          defaultValue={["apparence"]}
          className="px-4"
        >
          <AccordionSection value="apparence" title="Opacité de la métrique">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Opacité sur la carte</span>
              <span className="tabular-nums text-foreground">
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <Slider.Root
              className="relative mt-3 flex h-4 w-full touch-none items-center select-none"
              min={20}
              max={100}
              step={5}
              value={[Math.round(opacity * 100)]}
              onValueChange={([v]) => onOpacity(v / 100)}
              aria-label="Opacité de la métrique"
            >
              <Slider.Track className="relative h-1.5 grow rounded-full bg-muted">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb className="block size-4 rounded-full border-2 border-accent bg-background shadow transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </Slider.Root>
          </AccordionSection>

          <AccordionSection value="fond" title="Fond de carte">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Style et thème du fond</span>
              <InfoTip
                label="Fond de carte"
                text="Change le style de la carte : Clair et Sombre pour le mode, Satellite pour l'imagerie aérienne, Couleur pour un fond détaillé."
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {BASEMAP_KEYS.map((b) => (
                <Button
                  key={b}
                  size="sm"
                  variant={b === basemap ? "default" : "outline"}
                  className={
                    b === basemap
                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                      : undefined
                  }
                  onClick={() => onBasemap(b)}
                >
                  {BASEMAP_LABELS[b]}
                </Button>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection value="calques" title="Calques">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox.Root
                checked={wordCloudEnabled}
                onCheckedChange={(v) => onWordCloudEnabled(v === true)}
                className="flex size-4 shrink-0 items-center justify-center rounded border border-input bg-background data-[state=checked]:border-accent data-[state=checked]:bg-accent"
              >
                <Checkbox.Indicator>
                  <Check className="size-3 text-accent-foreground" />
                </Checkbox.Indicator>
              </Checkbox.Root>
              Nuage de mots des avis
            </label>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Affiche un marqueur par ville ; cliquez dessus pour voir les mots
              les plus fréquents dans les avis.
            </p>
          </AccordionSection>

          <AccordionSection value="centrer" title="Centrer la carte">
            <div className="grid gap-1.5">
              {CENTERS.map((c) => (
                <Button
                  key={c.label}
                  size="sm"
                  variant="outline"
                  className="justify-start"
                  onClick={() => onCenter(c.view)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </AccordionSection>
        </Accordion.Root>
      </aside>
    </Tooltip.Provider>
  )
}
