import { Accordion, Checkbox, Slider, Tooltip } from "radix-ui"
import { Check, ChevronDown, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  BivariateLegend,
  DivergingLegend,
  QuantileLegend,
} from "@/components/map-legend"
import { cn } from "@/lib/utils"
import {
  DIMENSIONS,
  METRIC_INFO,
  METRIC_LABELS,
  PRIX_METRICS,
  type Metric,
} from "@/lib/score"
import type { makeBivariateScale, MetricScale } from "@/lib/scoreColors"

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

// Groupes du sélecteur : hiérarchie mentale claire au lieu d'une liste plate
// de 17 entrées (audit L4).
const METRIC_GROUPS: { title: string; metrics: Metric[] }[] = [
  { title: "Synthèse", metrics: ["score_valeur", "gap_pondere"] },
  { title: "Prix (€/m²)", metrics: [...PRIX_METRICS] },
  { title: "Qualité de vie (dimensions)", metrics: [...DIMENSIONS] },
]

type ScoreSidebarProps = {
  metrics: Metric[]
  metric: Metric
  onMetric: (m: Metric) => void
  /** Échelle courante (bornes réelles pour la légende chiffrée). */
  scale: MetricScale
  bivarScale: ReturnType<typeof makeBivariateScale> | null
  format: (v: number) => string
  formatY: (v: number) => string
  opacity: number
  onOpacity: (v: number) => void
  basemap: Basemap
  onBasemap: (b: Basemap) => void
  onCenter: (view: MapView) => void
  bivariate: boolean
  onBivariate: (v: boolean) => void
  metricY: Metric
  onMetricY: (m: Metric) => void
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
  scale,
  bivarScale,
  format,
  formatY,
  opacity,
  onOpacity,
  basemap,
  onBasemap,
  onCenter,
  bivariate,
  onBivariate,
  metricY,
  onMetricY,
  isLoading,
  isError,
  wordCloudEnabled,
  onWordCloudEnabled,
}: ScoreSidebarProps) {
  return (
    <Tooltip.Provider>
      <aside className="flex h-svh w-80 shrink-0 flex-col overflow-y-auto border-r bg-card text-card-foreground">
        {/* Sélecteur de métrique : une ligne par catégorie, avec son « i ». */}
        <div className="px-4 py-3">
          <div className="text-sm font-semibold">Score territoire</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choisissez la métrique à cartographier.
          </p>
          <div className="mt-2 space-y-2.5">
            {METRIC_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="mb-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {group.metrics.map((m) => {
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
                            active ? "font-medium text-accent" : "text-foreground/80",
                          )}
                        >
                          {METRIC_LABELS[m]}
                        </button>
                        <InfoTip text={METRIC_INFO[m]} label={METRIC_LABELS[m]} />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Mode bivarié : croise la métrique courante avec une seconde. */}
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox.Root
              checked={bivariate}
              onCheckedChange={(v) => onBivariate(v === true)}
              className="flex size-4 shrink-0 items-center justify-center rounded border border-input bg-background data-[state=checked]:border-accent data-[state=checked]:bg-accent"
            >
              <Checkbox.Indicator>
                <Check className="size-3 text-accent-foreground" />
              </Checkbox.Indicator>
            </Checkbox.Root>
            Croiser avec une 2ᵉ métrique
            <InfoTip
              label="Mode bivarié"
              text="Croise deux métriques sur une palette 3×3 pour repérer par exemple les communes « bien notées et abordables »."
            />
          </label>
          {bivariate && (
            <select
              value={metricY}
              onChange={(e) => onMetricY(e.target.value as Metric)}
              aria-label="Seconde métrique"
              className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {metrics.map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABELS[m]}
                </option>
              ))}
            </select>
          )}

          {/* Légende CHIFFRÉE : les bornes affichées sont celles de l'échelle. */}
          <div className="mt-3">
            {bivariate && bivarScale ? (
              <BivariateLegend
                xLabel={METRIC_LABELS[metric]}
                yLabel={METRIC_LABELS[metricY]}
                tx={bivarScale.tx}
                ty={bivarScale.ty}
                formatX={format}
                formatY={formatY}
              />
            ) : scale.kind === "diverging" ? (
              <DivergingLegend bound={scale.bound} format={format} />
            ) : (
              <QuantileLegend
                thresholds={scale.thresholds}
                palette={scale.palette}
                format={format}
              />
            )}
          </div>

          {isLoading && (
            <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
          )}
          {isError && (
            <div className="mt-2 text-xs text-destructive">
              Données indisponibles — réessayez plus tard.
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
                  variant={b === basemap ? "accent" : "outline"}
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
