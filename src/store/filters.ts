import { create } from "zustand"

import type { Lod, Mesh, TypeLocal } from "@/lib/choropleth"

// Seuils de zoom deck.gl pilotant la maille et le niveau de détail géométrique.
// Drill-down 3 niveaux : régions (dézoom) -> départements -> communes (zoom).
export function meshForZoom(zoom: number): Mesh {
  if (zoom < 5.5) return "regions"
  return zoom >= 8 ? "communes" : "departements"
}

export function lodForZoom(zoom: number): Lod {
  if (zoom < 7) return "low"
  if (zoom < 10) return "mid"
  return "high"
}

// Représentation cartographique de la métrique courante : choroplèthe
// (surfaces), bulles (volume de transactions), heatmap/isolignes (points de
// mutations échantillonnés).
export type Representation = "choropleth" | "bubbles" | "heat"

interface FiltersState {
  typeLocal: TypeLocal
  setTypeLocal: (t: TypeLocal) => void
  representation: Representation
  setRepresentation: (r: Representation) => void
}

export const useFilters = create<FiltersState>((set) => ({
  typeLocal: "Tous",
  setTypeLocal: (typeLocal) => set({ typeLocal }),
  representation: "choropleth",
  setRepresentation: (representation) => set({ representation }),
}))
