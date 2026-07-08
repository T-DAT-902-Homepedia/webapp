// Navigation principale, partagée entre PageShell (pages contenu) et la barre
// des cartes plein écran. Libellés explicites : les deux cartes se distinguent
// par leur objet (prix vs qualité de vie), pas par un « Carte »/« Analyse »
// opaque.

export const NAV = [
  { to: "/carte", label: "Carte des prix" },
  { to: "/map", label: "Qualité de vie" },
  { to: "/explorer", label: "Explorer" },
  { to: "/classement", label: "Classement" },
] as const
