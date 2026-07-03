import { create } from "zustand"

import type { Lod, Mesh, TypeLocal } from "@/lib/choropleth"

// Seuils de zoom deck.gl pilotant la maille et le niveau de détail géométrique.
// En dézoom -> départements (LOD grossier) ; en zoom -> communes (LOD fin).
export function meshForZoom(zoom: number): Mesh {
  return zoom >= 8 ? "communes" : "departements"
}

export function lodForZoom(zoom: number): Lod {
  if (zoom < 7) return "low"
  if (zoom < 10) return "mid"
  return "high"
}

interface FiltersState {
  typeLocal: TypeLocal
  setTypeLocal: (t: TypeLocal) => void
}

export const useFilters = create<FiltersState>((set) => ({
  typeLocal: "Appartement",
  setTypeLocal: (typeLocal) => set({ typeLocal }),
}))
