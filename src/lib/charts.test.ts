import { describe, expect, it } from "vitest"

import { byCommune, prixDistributionSchema } from "@/lib/charts"

describe("byCommune", () => {
  it("indexe les lignes par code_commune", () => {
    const rows = [
      { code_commune: "75106", v: 1 },
      { code_commune: "29085", v: 2 },
    ]
    const m = byCommune(rows)
    expect(m.get("29085")?.v).toBe(2)
    expect(m.get("00000")).toBeUndefined()
  })
})

describe("prixDistributionSchema", () => {
  it("valide la forme publiée par export_charts.py", () => {
    const ok = {
      schema_version: 1,
      year: 2024,
      bin_edges: [0, 100, 200],
      series: { tous: [5, 3], maison: [2, 1], appartement: [3, 2] },
    }
    expect(prixDistributionSchema.parse(ok)).toEqual(ok)
  })

  it("rejette une enveloppe inattendue", () => {
    expect(() =>
      prixDistributionSchema.parse({ schema_version: 2, year: 2024 }),
    ).toThrow()
  })
})
