import { describe, expect, it } from "vitest"

import { deptFromCodeCommune } from "./commune"

describe("deptFromCodeCommune", () => {
  it("métropole, Corse et outre-mer", () => {
    expect(deptFromCodeCommune("75101")).toBe("75")
    expect(deptFromCodeCommune("2A004")).toBe("2A")
    expect(deptFromCodeCommune("2B033")).toBe("2B")
    expect(deptFromCodeCommune("97411")).toBe("974")
    expect(deptFromCodeCommune("97611")).toBe("976")
  })
})
