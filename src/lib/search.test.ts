import { describe, expect, it } from "vitest"

import { buildSearchIndex, normalizeText, searchCommunes, type SearchEntry } from "./search"

const entries: SearchEntry[] = [
  { c: "93031", n: "Épinay-sur-Seine", d: "93", p: 3400, s: 0.5 },
  { c: "93066", n: "Saint-Denis", d: "93", p: 4100, s: 0.55 },
  { c: "97411", n: "Saint-Denis", d: "974", p: 2600, s: null },
  { c: "2A004", n: "Ajaccio", d: "2A", p: 3000, s: 0.6 },
  { c: "35238", n: "Rennes", d: "35", p: 3900, s: 0.7 },
  { c: "73054", n: "Champagny-en-Vanoise", d: "73", p: 5200, s: null },
]

const index = buildSearchIndex(entries)

describe("normalizeText", () => {
  it("retire diacritiques, casse et unifie les séparateurs", () => {
    expect(normalizeText("Épinay-sur-Seine ")).toBe("epinay sur seine")
    expect(normalizeText("L'Haÿ-les-Roses")).toBe("l hay les roses")
    expect(normalizeText("Ajaccio")).toBe("ajaccio")
  })
})

describe("searchCommunes", () => {
  it("trouve par préfixe sans accent", () => {
    expect(searchCommunes(index, "epinay")[0].c).toBe("93031")
  })

  it("trouve les homonymes Saint-Denis (93 et 974)", () => {
    const results = searchCommunes(index, "saint denis")
    expect(results.map((r) => r.c)).toEqual(
      expect.arrayContaining(["93066", "97411"]),
    )
  })

  it("classe le préfixe exact avant le début de mot", () => {
    const results = searchCommunes(index, "champ")
    expect(results[0].c).toBe("73054")
  })

  it("requête code : préfixe INSEE ou département", () => {
    expect(searchCommunes(index, "97411")[0].c).toBe("97411")
    expect(searchCommunes(index, "2A").map((r) => r.c)).toContain("2A004")
    expect(searchCommunes(index, "93").length).toBeGreaterThanOrEqual(2)
  })

  it("moins de 2 caractères : aucun résultat", () => {
    expect(searchCommunes(index, "a")).toEqual([])
  })
})
