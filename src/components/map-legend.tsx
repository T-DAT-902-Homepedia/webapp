import type { ReactNode } from "react"

import { DIV_LEGEND } from "@/lib/scoreColors"
import {
  BIVAR_3X3,
  PRICE_HEAT_SEQ,
  rgbaToCss,
  rgbaToCssAlpha,
  type RGBA,
} from "@/lib/palettes"
import { formatInt } from "@/lib/format"

// Légendes de cartes CHIFFRÉES : les bornes affichées sont exactement celles
// des échelles (quantileThresholds / bound divergent / terciles bivariés),
// jamais recalculées ici. Un « Faible → Élevé » sans valeurs n'est pas une
// légende (audit L1/L2).

export function LegendCard({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
      {title && <div className="mb-1.5 font-semibold">{title}</div>}
      {children}
    </div>
  )
}

/** Légende d'échelle par quantiles : une pastille par classe, bornes réelles.
 *  `thresholds` = n-1 bornes pour n couleurs (contrat quantileThresholds). */
export function QuantileLegend({
  title,
  thresholds,
  palette,
  format,
  footer,
}: {
  title?: string
  thresholds: number[]
  palette: RGBA[]
  format: (v: number) => string
  footer?: ReactNode
}) {
  const rows = palette.map((color, i) => {
    const from = i === 0 ? null : thresholds[i - 1]
    const to = i === palette.length - 1 ? null : thresholds[i]
    const label =
      from == null && to == null
        ? "—"
        : from == null
          ? `< ${format(to!)}`
          : to == null
            ? `> ${format(from)}`
            : `${format(from)} – ${format(to)}`
    return { color, label }
  })

  return (
    <LegendCard title={title}>
      <div className="space-y-0.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="size-3 shrink-0 rounded-xs"
              style={{ backgroundColor: rgbaToCss(r.color) }}
            />
            <span className="tabular-nums text-muted-foreground">{r.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="size-3 shrink-0 rounded-xs bg-muted-foreground/25" />
          <span className="text-muted-foreground">Pas de donnée</span>
        </div>
      </div>
      {footer}
    </LegendCard>
  )
}

/** Légende divergente : dégradé PRGn avec bornes −bound / 0 / +bound réelles. */
export function DivergingLegend({
  title,
  bound,
  format,
  negLabel = "Surcotée",
  posLabel = "Sous-cotée",
}: {
  title?: string
  bound: number
  format: (v: number) => string
  negLabel?: string
  posLabel?: string
}) {
  return (
    <LegendCard title={title}>
      <div className="flex h-2 w-44 overflow-hidden rounded-sm">
        {DIV_LEGEND.map((c, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: rgbaToCss(c) }} />
        ))}
      </div>
      <div className="mt-0.5 flex w-44 justify-between tabular-nums text-muted-foreground">
        <span>{format(-bound)}</span>
        <span>0</span>
        <span>{format(bound)}</span>
      </div>
      <div className="mt-0.5 flex w-44 justify-between text-[10px] text-muted-foreground">
        <span>{negLabel}</span>
        <span>{posLabel}</span>
      </div>
    </LegendCard>
  )
}

/** Légende bivariée 3×3 : matrice + seuils de terciles réels sur chaque axe. */
export function BivariateLegend({
  xLabel,
  yLabel,
  tx,
  ty,
  formatX,
  formatY,
}: {
  xLabel: string
  yLabel: string
  tx: number[]
  ty: number[]
  formatX: (v: number) => string
  formatY: (v: number) => string
}) {
  return (
    <div className="flex items-end gap-2.5">
      <div className="flex flex-col gap-px">
        {[2, 1, 0].map((y) => (
          <div key={y} className="flex gap-px">
            {[0, 1, 2].map((x) => (
              <div
                key={x}
                className="size-4"
                style={{ backgroundColor: rgbaToCss(BIVAR_3X3[y][x]) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-0.5 text-[10px] leading-tight text-muted-foreground">
        <div>
          → {xLabel}
          {tx.length === 2 && (
            <span className="tabular-nums"> (seuils {formatX(tx[0])} · {formatX(tx[1])})</span>
          )}
        </div>
        <div>
          ↑ {yLabel}
          {ty.length === 2 && (
            <span className="tabular-nums"> (seuils {formatY(ty[0])} · {formatY(ty[1])})</span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Légende des bulles : aire ∝ volume, 3 repères étalonnés sur le max courant. */
export function BubbleLegend({ maxValue, title }: { maxValue: number; title?: string }) {
  const steps = [1, 0.25, 0.05].map((f) => ({
    value: Math.max(1, Math.round(maxValue * f)),
    // rayon relatif = sqrt(part du max), sur un rayon de référence de 18 px
    r: Math.max(3, Math.sqrt(f) * 18),
  }))
  return (
    <LegendCard title={title ?? "Volume de ventes"}>
      <div className="flex items-end gap-3">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span
              className="rounded-full border border-foreground/40 bg-foreground/10"
              style={{ width: s.r * 2, height: s.r * 2 }}
            />
            <span className="tabular-nums text-muted-foreground">
              {formatInt(s.value)}
            </span>
          </div>
        ))}
      </div>
    </LegendCard>
  )
}

/** Légende heatmap : dégradé construit sur la palette réelle de la couche
 *  (PRICE_HEAT_SEQ). Mode « prix » : bornes chiffrées du colorDomain (€/m²) ;
 *  mode « ventes » : densité relative Faible → Forte. */
export function HeatLegend({
  mode,
  domain,
  contours,
}: {
  mode: "prix" | "ventes"
  /** Bornes réelles du colorDomain en €/m² (mode prix uniquement). */
  domain?: [number, number]
  contours: boolean
}) {
  const stops = PRICE_HEAT_SEQ.map(rgbaToCss)
  // En densité, le bas de rampe fond en transparence (threshold de la couche).
  const gradient =
    mode === "ventes"
      ? `linear-gradient(to right, ${rgbaToCssAlpha(PRICE_HEAT_SEQ[0], 0)}, ${stops.join(", ")})`
      : `linear-gradient(to right, ${stops.join(", ")})`
  return (
    <LegendCard
      title={mode === "prix" ? "Prix moyen lissé (€/m²)" : "Densité (nombre de ventes)"}
    >
      <div className="h-2 w-44 rounded-sm" style={{ background: gradient }} />
      {mode === "prix" && domain ? (
        <>
          <div className="mt-0.5 flex w-44 justify-between tabular-nums text-muted-foreground">
            <span>{formatInt(domain[0])}</span>
            <span>{formatInt((domain[0] + domain[1]) / 2)}</span>
            <span>{formatInt(domain[1])}</span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Sous {formatInt(domain[0])} €/m² : fondu transparent.
          </p>
        </>
      ) : (
        <div className="mt-0.5 flex w-44 justify-between text-[10px] text-muted-foreground">
          <span>Faible</span>
          <span>Forte</span>
        </div>
      )}
      {contours && (
        <div className="mt-1.5 space-y-0.5 text-muted-foreground">
          {[
            { c: "rgb(8,81,156)", label: "≥ 5 ventes / cellule (4 km)" },
            { c: "rgb(49,130,189)", label: "≥ 25 ventes" },
            { c: "rgb(222,45,38)", label: "≥ 100 ventes" },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ backgroundColor: row.c }} />
              <span>{row.label}</span>
            </div>
          ))}
        </div>
      )}
    </LegendCard>
  )
}
