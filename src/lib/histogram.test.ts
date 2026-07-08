import { describe, expect, it } from "vitest"

import { binIndexOf, buildHistogram } from "./histogram"

describe("buildHistogram", () => {
  it("répartit les valeurs en bins uniformes", () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    const bins = buildHistogram(values, 5, 1)
    expect(bins).toHaveLength(5)
    expect(bins[0].from).toBe(0)
    expect(bins.at(-1)!.to).toBe(1000)
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(values.length)
  })

  it("ignore null/undefined et clippe la traîne", () => {
    const values = [...Array.from({ length: 99 }, (_, i) => 1000 + i), 1_000_000, null]
    const bins = buildHistogram(values, 10)
    // l'outlier au-delà du p99 est écarté, pas accumulé dans le dernier bin
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(99)
  })

  it("liste vide -> aucun bin", () => {
    expect(buildHistogram([null, undefined])).toEqual([])
  })
})

describe("binIndexOf", () => {
  const bins = buildHistogram([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], 5, 1)
  it("trouve le bin contenant la valeur (borne haute incluse au dernier)", () => {
    expect(binIndexOf(bins, 0)).toBe(0)
    expect(binIndexOf(bins, 999)).toBe(4)
    expect(binIndexOf(bins, 1000)).toBe(4)
  })
  it("hors domaine ou null -> null", () => {
    expect(binIndexOf(bins, 5000)).toBeNull()
    expect(binIndexOf(bins, null)).toBeNull()
  })
})
