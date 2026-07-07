import { useState, type ReactNode } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { SearchCommand, SearchTrigger } from "@/components/search-command"
import { useSearchShortcut } from "@/hooks/useSearchShortcut"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/carte", label: "Carte" },
  { to: "/map", label: "Analyse" },
  { to: "/explorer", label: "Explorer" },
  { to: "/classement", label: "Classement" },
]

/**
 * Coquille commune des pages hors carte plein écran : header sticky (logo,
 * navigation, recherche globale Ctrl+K -> fiche commune) + contenu centré.
 * `actions` accueille des boutons additionnels propres à la page.
 */
export function PageShell({
  children,
  actions,
}: {
  children: ReactNode
  actions?: ReactNode
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  useSearchShortcut(setSearchOpen)

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            Homepedia<span className="text-accent">.</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors hover:bg-muted",
                  pathname.startsWith(item.to)
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <SearchTrigger onOpen={() => setSearchOpen(true)} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>

      <SearchCommand
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(entry) => navigate(`/commune/${entry.c}`)}
      />
    </div>
  )
}
