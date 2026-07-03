import { ArrowRight, BarChart3, Map, Scale } from "lucide-react"
import { Link } from "react-router-dom"

import { FranceOutline } from "@/components/france-outline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const STATS = [
  { value: "34 935", label: "communes couvertes" },
  { value: "5M+", label: "transactions DVF analysées" },
  { value: "13", label: "régions comparables" },
  { value: "10 ans", label: "d'historique de prix" },
]

const FEATURES = [
  {
    icon: Map,
    title: "Carte interactive",
    description:
      "Explorez les prix au m² sur toute la France, du niveau régional jusqu'à la commune. Zoomez, filtrez, et voyez le marché se dessiner sous vos yeux.",
  },
  {
    icon: BarChart3,
    title: "Statistiques par ville",
    description:
      "Prix médians, volumes de ventes, évolution sur dix ans : chaque commune a sa fiche détaillée, alimentée par les données ouvertes officielles.",
  },
  {
    icon: Scale,
    title: "Comparaison de territoires",
    description:
      "Mettez deux villes côte à côte et comparez prix, dynamique du marché et profil démographique pour éclairer vos décisions.",
  },
]

export function Landing() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-xl font-bold tracking-tight">
            Homepedia<span className="text-accent">.</span>
          </span>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href="#fonctionnalites">Fonctionnalités</a>
            </Button>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              asChild
            >
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
            className="mb-6 border-accent/30 bg-accent/5 text-accent"
          >
            Données ouvertes · DVF · INSEE
          </Badge>
          <h1 className="max-w-3xl font-display text-5xl leading-[1.05] font-bold tracking-tight text-balance md:text-7xl">
            Le marché immobilier français,{" "}
            <span className="text-accent">cartographié</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Homepedia agrège les transactions immobilières publiques et les
            données territoriales pour vous donner une vision claire des prix,
            ville par ville, quartier par quartier.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              asChild
            >
              <Link to="/carte">
                Explorer la carte
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#fonctionnalites">Découvrir les fonctionnalités</a>
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
          <p className="text-sm text-muted-foreground">
            Homepedia — projet de data-visualisation immobilière.
          </p>
          <p className="text-sm text-muted-foreground">
            Données : DVF (Etalab) · INSEE
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
