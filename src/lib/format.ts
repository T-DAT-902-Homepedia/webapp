// Formatage fr-FR partagé (tooltips carte, fiches, tableaux). Tout null ou
// undefined rend un tiret cadratin : les feuilles du contrat CDN sont
// individuellement nullables.

/** Marqueur unique d'absence de donnée (bannit les « n/d » épars). */
export const NA = "—"

const EMPTY = NA

export function formatEuroM2(v: number | null | undefined): string {
  if (v == null) return EMPTY
  return `${Math.round(v).toLocaleString("fr-FR")} €/m²`
}

export function formatEuro(v: number | null | undefined): string {
  if (v == null) return EMPTY
  return `${Math.round(v).toLocaleString("fr-FR")} €`
}

export function formatInt(v: number | null | undefined): string {
  if (v == null) return EMPTY
  return Math.round(v).toLocaleString("fr-FR")
}

export function formatDecimal(v: number | null | undefined, digits = 1): string {
  if (v == null) return EMPTY
  return v.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v == null) return EMPTY
  return `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`
}

/** Score 0-1 -> « 61 / 100 » (lecture plus naturelle qu'un décimal). */
export function formatScore(v: number | null | undefined): string {
  if (v == null) return EMPTY
  return `${Math.round(v * 100)} / 100`
}

/** Gap signé : « +0,05 » / « −0,12 ». */
export function formatSigned(v: number | null | undefined, digits = 2): string {
  if (v == null) return EMPTY
  const s = v.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return v >= 0 ? `+${s}` : s
}
