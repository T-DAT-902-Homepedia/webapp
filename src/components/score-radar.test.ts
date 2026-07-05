import { describe, expect, it } from "vitest"

import { sourceProfile } from "@/components/score-radar"
import { DIMENSIONS, SOURCE_GROUPS, type ScoreProperties } from "@/lib/score"

// Fabrique des properties avec toutes les dimensions à `base`, surchargées ensuite.
function props(
  base: number | null,
  overrides: Partial<ScoreProperties> = {},
): ScoreProperties {
  const p = { code_commune: "00000" } as ScoreProperties
  for (const d of DIMENSIONS) p[d] = base
  return { ...p, ...overrides }
}

describe("sourceProfile", () => {
  it("couvre les 12 dimensions, chacune dans exactement un groupe", () => {
    const grouped = SOURCE_GROUPS.flatMap((g) => g.dims)
    expect([...grouped].sort()).toEqual([...DIMENSIONS].sort())
  })

  it("moyenne les dimensions de chaque source", () => {
    // Immobilier = [n_prix, n_access_fin] -> (0.2 + 0.6) / 2 = 0.4
    const vals = sourceProfile(props(0.5, { n_prix: 0.2, n_access_fin: 0.6 }))
    expect(vals[0]).toBeCloseTo(0.4)
    expect(vals[1]).toBeCloseTo(0.5) // Transport : toutes à 0.5
  })

  it("ignore les NULL dans la moyenne", () => {
    // Immobilier : n_prix NULL -> moyenne sur n_access_fin seul.
    const vals = sourceProfile(props(0.5, { n_prix: null, n_access_fin: 0.8 }))
    expect(vals[0]).toBeCloseTo(0.8)
  })

  it("retourne 0 pour un groupe entièrement NULL", () => {
    expect(sourceProfile(props(null))).toEqual([0, 0, 0, 0, 0])
  })
})
