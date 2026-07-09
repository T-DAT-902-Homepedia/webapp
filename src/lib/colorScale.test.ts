import { describe, expect, it } from "vitest"

import { makeColorScale } from "@/lib/colorScale"
import { NO_DATA } from "@/lib/palettes"
import type { ChoroplethFeature, ChoroplethProperties } from "@/lib/choropleth"

// Fixture minimale : makeColorScale ne lit que properties via les accessors.
const feature = (prix: number | null, fiable = true) =>
  ({
    type: "Feature",
    geometry: null,
    properties: { prix_m2_median: prix, fiable },
  }) as unknown as ChoroplethFeature

const getValue = (p: ChoroplethProperties) => p.prix_m2_median
const getFiable = (p: ChoroplethProperties) => p.fiable

describe("makeColorScale().color (value-based, couche IRIS)", () => {
  const features = [1000, 2000, 3000, 4000, 5000, 6000, null].map((v) =>
    feature(v),
  )
  const scale = makeColorScale(features, getValue, getFiable)

  it("rend NO_DATA pour null", () => {
    expect(scale.color(null)).toEqual(NO_DATA)
    expect(scale.color(undefined)).toEqual(NO_DATA)
  })

  it("atténue l'alpha à 110 quand fiable=false", () => {
    const plein = scale.color(3000)
    const attenue = scale.color(3000, false)
    expect(attenue.slice(0, 3)).toEqual(plein.slice(0, 3))
    expect(attenue[3]).toBe(110)
  })

  it("reste cohérente avec getColor (mêmes seuils commune/quartier)", () => {
    for (const f of [feature(1500), feature(5500), feature(null), feature(2500, false)]) {
      expect(scale.color(getValue(f.properties), getFiable(f.properties))).toEqual(
        scale.getColor(f),
      )
    }
  })
})
