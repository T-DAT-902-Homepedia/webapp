import {
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Gauge,
  Heart,
  Map,
  Scale,
  TrendingUp,
} from "lucide-react"
import { Link } from "react-router-dom"

import { FranceOutline } from "@/components/france-outline"
import { TricolorMark } from "@/components/tricolor-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useMeta } from "@/hooks/useMeta"
import { NAV } from "@/lib/nav"
import { formatInt } from "@/lib/format"
import type { Meta } from "@/lib/data"

// Chiffres réels du run courant (meta.json) ; repli sur les derniers connus
// tant que meta charge (évite un flash de zéros).
function buildStats(meta: Meta | undefined) {
  return [
    {
      value: meta ? formatInt(meta.nb_communes) : "34 933",
      label: "communes couvertes",
    },
    {
      value: meta ? formatInt(meta.nb_communes_scorees) : "17 774",
      label: "communes notées qualité de vie",
    },
    { value: "12", label: "dimensions analysées par commune" },
    {
      value: meta ? String(meta.year) : "2024",
      label: "millésime DVF analysé",
    },
  ]
}

// Une carte par vraie fonctionnalité de l'app (routes de NAV + comparateur) :
// pas de promesse au-delà de ce que les pages livrent.
const FEATURES = [
  {
    icon: Map,
    title: "Carte des prix",
    description:
      "Choroplèthe, bulles ou heatmap : les prix au m² de la région à la commune, jusqu'aux ventes individuelles à fort zoom. Filtres par type de bien, quatre fonds de carte.",
  },
  {
    icon: Gauge,
    title: "Qualité de vie",
    description:
      "Un score par commune décomposé en 12 dimensions — transport, sécurité, climat, services… — à croiser avec les prix sur une carte bivariée, avis d'habitants à l'appui dans les grandes villes.",
  },
  {
    icon: Scale,
    title: "Communes sous-cotées",
    description:
      "L'écart qualité/prix repère les territoires qui offrent plus que leur prix ne le suggère : classement national et carte dédiée pour dénicher les bonnes affaires.",
  },
  {
    icon: BarChart3,
    title: "Fiches communes",
    description:
      "Prix médians, volumes de ventes, évolution 2021-2025 et radar de qualité de vie : chaque commune a sa fiche détaillée, partageable par simple lien.",
  },
  {
    icon: ArrowLeftRight,
    title: "Comparateur",
    description:
      "Deux communes côte à côte : profils de score superposés, évolutions de prix et indicateurs clés réunis dans un même tableau.",
  },
  {
    icon: TrendingUp,
    title: "Vues d'ensemble",
    description:
      "Distribution nationale des prix, nuage prix × qualité de vie et palmarès des régions : trois lectures du marché pour situer n'importe quelle commune.",
  },
]

export function Landing() {
  const { data: meta } = useMeta()
  const STATS = buildStats(meta)
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <TricolorMark />
            <span>
              Homepedia<span className="text-accent">.</span>
            </span>
          </span>
          <nav className="flex items-center gap-1 sm:gap-2">
            {NAV.map((item) => (
              <Button
                key={item.to}
                variant="ghost"
                size="sm"
                asChild
                className="max-sm:hidden"
              >
                <Link to={item.to}>{item.label}</Link>
              </Button>
            ))}
            <Button size="sm" variant="accent" asChild>
              <Link to="/carte">
                Explorer la carte
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <FranceOutline
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-[-14%] hidden w-[740px] -translate-y-1/5 text-accent lg:block xl:right-[-30%] xl:w-[1800px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black_30%,transparent_100%)] bg-[size:56px_56px]"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 border-accent/30 bg-accent/5 text-accent"
          >
            <TricolorMark />
            Données ouvertes
          </Badge>
          <h1 className="max-w-3xl font-display text-5xl leading-[1.05] font-bold tracking-tight text-balance md:text-7xl">
            Le marché immobilier{" "}
            <span className="text-brand-red">français</span>,{" "}
            <span className="text-accent">cartographié</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Homepedia croise les transactions immobilières publiques avec les
            données territoriales — transport, sécurité, climat, services —
            pour lire les prix et la qualité de vie, de la région jusqu'à la
            commune, à la vente près.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button size="lg" variant="accent" asChild>
              <Link to="/carte">
                Explorer la carte des prix
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="brand" asChild>
              <Link to="/map">
                <Heart className="size-4 fill-current" />
                Analyser la qualité de vie
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-border md:grid-cols-4 md:divide-x">
          {STATS.map((stat) => (
            <div key={stat.label} className="px-6 py-10">
              <p className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="fonctionnalites" className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-sm font-medium tracking-widest text-accent uppercase">
            Fonctionnalités
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl">
            Toute la donnée, sans le bruit.
          </h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="group">
                <div className="flex size-11 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 md:flex-row md:items-center">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TricolorMark />
            Homepedia — projet de data-visualisation immobilière.
          </p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/comparer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Comparer
            </Link>
          </nav>
          <p className="text-sm text-muted-foreground">
            Données publiques : DVF (Etalab) · INSEE · Géorisques · ADEME
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
