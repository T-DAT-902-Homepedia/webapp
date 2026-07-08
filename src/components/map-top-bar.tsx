import { useState, type ReactNode } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { SearchCommand, SearchTrigger } from "@/components/search-command"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSearchShortcut } from "@/hooks/useSearchShortcut"
import { NAV } from "@/lib/nav"
import type { SearchEntry } from "@/lib/search"
import { cn } from "@/lib/utils"

/**
 * Barre de navigation overlay des cartes plein écran : logo, navigation
 * commune, recherche Ctrl+K et bascule de thème — les cartes n'étaient
 * accessibles qu'à l'aveugle (aucun lien entrant/sortant, audit N1/N2).
 * `onSelectCommune` personnalise la recherche (ex. /map reste sur la carte) ;
 * `extra` accueille un lien croisé « Voir cette zone sur… ».
 */
export function MapTopBar({
  onSelectCommune,
  extra,
}: {
  onSelectCommune?: (entry: SearchEntry) => void
  extra?: ReactNode
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  useSearchShortcut(setSearchOpen)

  return (
    <>
      <div className="absolute inset-x-0 top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4">
          <Link
            to="/"
            className="font-display text-base font-bold tracking-tight sm:text-lg"
          >
            Homepedia<span className="text-accent">.</span>
          </Link>
          <nav className="flex items-center gap-0.5 overflow-x-auto text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-2.5 py-1 whitespace-nowrap transition-colors hover:bg-muted",
                  pathname.startsWith(item.to)
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {extra}
            <SearchTrigger onOpen={() => setSearchOpen(true)} />
            <ThemeToggle />
          </div>
        </div>
      </div>

      <SearchCommand
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(entry) =>
          onSelectCommune ? onSelectCommune(entry) : navigate(`/commune/${entry.c}`)
        }
      />
    </>
  )
}
