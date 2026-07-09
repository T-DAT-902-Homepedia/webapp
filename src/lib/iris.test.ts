import { describe, expect, it } from "vitest"

import {
  hasIrisMetric,
  irisMetricValue,
  irisPath,
  irisPropertiesSchema,
  type IrisProperties,
} from "@/lib/iris"
import { metaSchema } from "@/lib/data"

describe("irisPath", () => {
  it("cible le fichier par département, DROM et Corse compris", () => {
    expect(irisPath("75")).toBe("choropleth/iris-high/75.geojson")
    expect(irisPath("2A")).toBe("choropleth/iris-high/2A.geojson")
    expect(irisPath("974")).toBe("choropleth/iris-high/974.geojson")
  })
})

describe("irisPropertiesSchema", () => {
  const nominal: IrisProperties = {
    code_iris: "693860301",
    nom: "Debrousse",
    code_commune: "69385", // arrondissement PLM : la fiche commune existe
    nom_commune: "Lyon 5e Arrondissement",
    type_iris: "H",
    code_departement: "69",
    prix_m2_median: 6529,
    nb_transactions: 87,
    fiable: true,
    annee_min: 2020,
    annee_max: 2024,
    score_commune: 0.61,
    n_prix_iris: 0.31,
    gap_iris: -0.233,
    gap_pondere_iris: -0.233,
  }

  it("valide une feature nominale", () => {
    expect(irisPropertiesSchema.parse(nominal)).toEqual(nominal)
  })

  it("accepte fiable=false avec toutes les valeurs à null (pas de donnée)", () => {
    expect(() =>
      irisPropertiesSchema.parse({
        ...nominal,
        fiable: false,
        prix_m2_median: null,
        nb_transactions: null,
        annee_min: null,
        annee_max: null,
        score_commune: null,
        n_prix_iris: null,
        gap_iris: null,
        gap_pondere_iris: null,
      }),
    ).not.toThrow()
  })

  it("rejette une feature sans code_iris", () => {
    const sansCode: Record<string, unknown> = { ...nominal }
    delete sansCode.code_iris
    expect(() => irisPropertiesSchema.parse(sansCode)).toThrow()
  })
})

describe("irisMetricValue", () => {
  const p = irisPropertiesSchema.parse({
    code_iris: "693890101",
    nom: "Le Château",
    code_commune: "69389",
    nom_commune: "Lyon 9e Arrondissement",
    type_iris: "H",
    code_departement: "69",
    prix_m2_median: 2334,
    nb_transactions: 54,
    fiable: true,
    annee_min: 2020,
    annee_max: 2024,
    score_commune: 0.58,
    n_prix_iris: 0.72,
    gap_iris: 0.197,
    gap_pondere_iris: 0.197,
  })

  it("mappe les métriques communes vers les noms IRIS", () => {
    expect(irisMetricValue(p, "score_valeur")).toBe(0.58)
    expect(irisMetricValue(p, "gap_pondere")).toBe(0.197)
    expect(irisMetricValue(p, "prix")).toBe(2334)
  })

  it("retourne null pour les métriques absentes de la maille IRIS", () => {
    expect(irisMetricValue(p, "n_transport")).toBeNull()
    expect(irisMetricValue(p, "prix_maison")).toBeNull()
  })
})

describe("hasIrisMetric", () => {
  it("distingue les métriques mappées (axes bivariés valides) des absentes", () => {
    expect(hasIrisMetric("score_valeur")).toBe(true)
    expect(hasIrisMetric("gap_pondere")).toBe(true)
    expect(hasIrisMetric("prix")).toBe(true)
    expect(hasIrisMetric("n_transport")).toBe(false)
    expect(hasIrisMetric("prix_maison")).toBe(false)
  })
})

describe("metaSchema (feature-gate IRIS)", () => {
  const base = {
    schema_version: 1,
    run_date: "2026-07-02",
    year: 2024,
    base: "runs/2026-07-02",
    nb_communes: 34000,
    nb_communes_scorees: 30000,
    generated_at: "2026-07-02T10:00:00Z",
  }

  it("parse un ancien run sans nb_iris (couche masquée)", () => {
    const meta = metaSchema.parse(base)
    expect(meta.nb_iris).toBeUndefined()
  })

  it("parse un run avec la maille quartier", () => {
    const meta = metaSchema.parse({
      ...base,
      nb_iris: 16400,
      nb_iris_scores: 14500,
    })
    expect(meta.nb_iris).toBe(16400)
    expect(meta.nb_iris_scores).toBe(14500)
  })
})
