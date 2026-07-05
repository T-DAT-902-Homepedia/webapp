import { describe, expect, it } from "vitest"

import { BIVAR_PALETTE, makeBivariateScale } from "@/lib/scoreColors"

describe("makeBivariateScale", () => {
  // 9 valeurs uniformes 1..9 sur chaque axe : terciles nets (1-3, 4-6, 7-9).
  const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  it("classe les valeurs en terciles sur chaque axe", () => {
    const s = makeBivariateScale(vals, vals)
    expect(s.classes(1, 1)).toEqual([0, 0])
    expect(s.classes(5, 5)).toEqual([1, 1])
    expect(s.classes(9, 9)).toEqual([2, 2])
    expect(s.classes(9, 1)).toEqual([2, 0])
  })

  it("mappe les classes sur la palette [y][x]", () => {
    const s = makeBivariateScale(vals, vals)
    expect(s.color(1, 1)).toEqual(BIVAR_PALETTE[0][0])
    expect(s.color(9, 9)).toEqual(BIVAR_PALETTE[2][2])
    // x élevé, y faible -> colonne 2, ligne 0.
    expect(s.color(9, 1)).toEqual(BIVAR_PALETTE[0][2])
  })

  it("retourne no-data si une des deux valeurs manque", () => {
    const s = makeBivariateScale(vals, vals)
    expect(s.classes(null, 5)).toBeNull()
    expect(s.classes(5, undefined)).toBeNull()
    expect(s.color(null, 5)[3]).toBeLessThan(255) // gris translucide « no data »
  })

  it("reste stable avec moins de 2 valeurs (tout en classe 0)", () => {
    const s = makeBivariateScale([0.5], [])
    expect(s.classes(0.5, 0.5)).toEqual([0, 0])
  })
})
