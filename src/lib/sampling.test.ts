import { describe, expect, it } from "vitest"

import { stratifiedSample } from "./sampling"

describe("stratifiedSample", () => {
  const items = Array.from({ length: 10_000 }, (_, i) => ({ v: i }))

  it("retourne tel quel sous la cible", () => {
    expect(stratifiedSample(items.slice(0, 50), (x) => x.v, 100)).toHaveLength(50)
  })

  it("préserve les extrêmes et la taille cible", () => {
    const out = stratifiedSample(items, (x) => x.v, 500)
    expect(out).toHaveLength(500)
    expect(out[0].v).toBe(0)
    expect(out.at(-1)!.v).toBeGreaterThan(9900)
  })

  it("déterministe (pas d'aléatoire)", () => {
    const a = stratifiedSample(items, (x) => x.v, 500)
    const b = stratifiedSample(items, (x) => x.v, 500)
    expect(a).toEqual(b)
  })
})
