import { useState, type ReactNode } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Menu, X } from "lucide-react"

import { SearchCommand, SearchTrigger } from "@/components/search-command"
import { ThemeToggle } from "@/components/theme-toggle"
import { TricolorMark } from "@/components/tricolor-mark"
import { Button } from "@/components/ui/button"
import { useSearchShortcut } from "@/hooks/useSearchShortcut"
import { NAV } from "@/lib/nav"
import { cn } from "@/lib/utils"

/**
 * Coquille commune des pages hors carte plein écran : header sticky (logo,
 * navigation — repliée en menu burger sous md —, recherche globale Ctrl+K,
 * bascule de thème) + contenu centré. `actions` accueille des boutons
 * additionnels propres à la page.
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
  const [menuOpen, setMenuOpen] = useState(false)
  useSearchShortcut(setSearchOpen)

  const navLink = (item: (typeof NAV)[number], mobile = false) => (
    <Link
      key={item.to}
      to={item.to}
      onClick={() => setMenuOpen(false)}
      className={cn(
        "rounded-md px-3 py-1.5 transition-colors hover:bg-muted",
        mobile && "block py-2 text-base",
        pathname.startsWith(item.to)
          ? "font-semibold text-foreground"
          : "text-muted-foreground",
      )}
    >
      {item.label}
    </Link>
  )

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight"
          >
            <TricolorMark />
            <span>
              Homepedia<span className="text-accent">.</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {NAV.map((item) => navLink(item))}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {actions}
            <SearchTrigger onOpen={() => setSearchOpen(true)} />
            <ThemeToggle />
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t px-4 py-2 md:hidden">
            {NAV.map((item) => navLink(item, true))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>

      <SearchCommand
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(entry) => navigate(`/commune/${entry.c}`)}
      />
    </div>
  )
}
