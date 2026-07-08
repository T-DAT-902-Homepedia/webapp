// Source UNIQUE des palettes de données : la même donnée porte la même
// couleur sur toutes les pages (l'audit relevait 2 palettes pour le prix et
// 4 codages pour l'écart qualité/prix).
//
// - Prix (€/m²)              -> PRICE_SEQ (YlOrRd : « chaud = cher »)
// - Score & 12 dimensions    -> SCORE_SEQ (bleu-violet, réservé au score :
//                               la distinction prix/score est porteuse de sens)
// - Écart qualité/prix (gap) -> GAP_* (PRGn : vert = sous-cotée/bonne affaire,
//                               violet = surcotée ; CVD-safe, ne collisionne
//                               pas avec le YlOrRd du prix)
// - Sentiment des avis       -> mêmes pôles PRGn (positif = vert)

export type RGBA = [number, number, number, number]

export const NO_DATA: RGBA = [200, 200, 200, 60]

// --- Prix : YlOrRd 6 classes ----------------------------------------------------

export const PRICE_SEQ: RGBA[] = [
  [255, 255, 178, 255],
  [254, 217, 118, 255],
  [254, 178, 76, 255],
  [253, 141, 60, 255],
  [240, 59, 32, 255],
  [189, 0, 38, 255],
]

// --- Score & dimensions : séquentiel bleu-violet 6 classes -----------------------

export const SCORE_SEQ: RGBA[] = [
  [237, 248, 251, 255],
  [191, 211, 230, 255],
  [158, 188, 218, 255],
  [140, 150, 198, 255],
  [136, 86, 167, 255],
  [129, 15, 124, 255],
]

// --- Gap : divergent PRGn (violet = surcoté, vert = sous-coté) -------------------

export const GAP_NEG: RGBA = [118, 42, 131, 255] // #762a83
export const GAP_MID: RGBA = [247, 247, 247, 255] // #f7f7f7
export const GAP_POS: RGBA = [27, 120, 55, 255] // #1b7837

/** PRGn 7 classes (hex, pour les rendus SVG/Recharts). */
export const GAP_PRGN_HEX = [
  "#762a83",
  "#af8dc3",
  "#e7d4e8",
  "#f7f7f7",
  "#d9f0d3",
  "#7fbf7b",
  "#1b7837",
] as const

export const GAP_POS_HEX = "#1b7837"
export const GAP_NEG_HEX = "#762a83"
// Variantes claires lisibles sur fond sombre (classes 2/6 de la rampe).
export const GAP_POS_LIGHT_HEX = "#7fbf7b"
export const GAP_NEG_LIGHT_HEX = "#af8dc3"

// Classes texte prêtes à l'emploi pour les valeurs de gap (clair + sombre).
export const GAP_TEXT_POS = "text-[#1b7837] dark:text-[#7fbf7b]"
export const GAP_TEXT_NEG = "text-[#762a83] dark:text-[#af8dc3]"

// --- Bivarié 3×3 (bleu-violet, Joshua Stevens) -----------------------------------

// BIVAR_3X3[y][x] : x = classe de la 1re métrique, y = de la 2e, 0 = faible.
export const BIVAR_3X3: RGBA[][] = [
  [[232, 232, 232, 255], [172, 228, 228, 255], [90, 200, 200, 255]],
  [[223, 176, 214, 255], [165, 173, 211, 255], [86, 152, 185, 255]],
  [[190, 100, 172, 255], [140, 98, 170, 255], [59, 73, 148, 255]],
]

export const rgbaToCss = (c: RGBA) => `rgb(${c[0]},${c[1]},${c[2]})`
