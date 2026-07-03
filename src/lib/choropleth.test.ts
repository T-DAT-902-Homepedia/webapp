import { describe, expect, it } from "vitest"

import {
  choroplethPath,
  normalizeGeometry,
  statsForType,
  type ChoroplethProperties,
} from "@/lib/choropleth"

describe("choroplethPath", () => {
  it("mappe les départements sur low ou mid uniquement", () => {
    expect(choroplethPath("departements", "low")).toBe("choropleth/departements-low.geojson")
    expect(choroplethPath("departements", "mid")).toBe("choropleth/departements-mid.geojson")
    // high n'existe pas pour les départements : clampé sur mid.
    expect(choroplethPath("departements", "high")).toBe("choropleth/departements-mid.geojson")
  })

  it("mappe les communes sur mid par défaut", () => {
    expect(choroplethPath("communes", "low")).toBe("choropleth/communes-mid.geojson")
    expect(choroplethPath("communes", "mid")).toBe("choropleth/communes-mid.geojson")
    // Sans code département, high retombe sur mid (clamp PR1).
    expect(choroplethPath("communes", "high")).toBe("choropleth/communes-mid.geojson")
  })

  it("cible le fichier par département en high avec un code (PR3)", () => {
    expect(choroplethPath("communes", "high", "2A")).toBe(
      "choropleth/communes-high/2A.geojson",
    )
    expect(choroplethPath("communes", "high", "974")).toBe(
      "choropleth/communes-high/974.geojson",
    )
  })
})

describe("normalizeGeometry", () => {
  it("laisse passer les géométries simples et null", () => {
    const poly = { type: "Polygon", coordinates: [[[0, 0]]] }
    expect(normalizeGeometry(poly)).toBe(poly)
    expect(normalizeGeometry(null)).toBeNull()
  })

  it("extrait les polygones d'une GeometryCollection et jette les lignes", () => {
    const collection = {
      type: "GeometryCollection",
      geometries: [
        { type: "Polygon", coordinates: [[[0, 0]]] },
        { type: "MultiPolygon", coordinates: [[[[1, 1]]], [[[2, 2]]]] },
        { type: "LineString", coordinates: [[3, 3]] },
      ],
    }
    expect(normalizeGeometry(collection)).toEqual({
      type: "MultiPolygon",
      coordinates: [[[[0, 0]]], [[[1, 1]]], [[[2, 2]]]],
    })
  })

  it("retourne null si la collection ne contient aucun polygone", () => {
    expect(
      normalizeGeometry({
        type: "GeometryCollection",
        geometries: [{ type: "LineString", coordinates: [[0, 0]] }],
      }),
    ).toBeNull()
  })
})

describe("statsForType", () => {
  const props: ChoroplethProperties = {
    code_departement: "31",
    nom: "Toulouse",
    prix_m2_median: 3200,
    nb_transactions: 4200,
    fiable: true,
    maison_prix_m2_median: 3500,
    maison_nb_transactions: 1200,
    maison_fiable: true,
    appart_prix_m2_median: null,
    appart_nb_transactions: 12,
    appart_fiable: false,
  }

  it("retourne les colonnes du type demandé", () => {
    expect(statsForType(props, "Maison")).toEqual({ prix: 3500, nb: 1200, fiable: true })
    expect(statsForType(props, "Appartement")).toEqual({ prix: null, nb: 12, fiable: false })
  })
})
