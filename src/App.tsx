import { lazy, Suspense } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"

import Landing from "@/pages/landing"
import DvfMap from "@/pages/dvf-map"
import ScoreMap from "@/pages/score-map"
import Undervalued from "@/pages/undervalued"

// Pages hors carte : lazy pour garder Recharts (~100 Ko gz) hors du bundle
// initial des cartes.
const Commune = lazy(() => import("@/pages/commune"))
const Comparer = lazy(() => import("@/pages/comparer"))
const Explorer = lazy(() => import("@/pages/explorer"))

function Loading() {
  return (
    <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
      Chargement…
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/carte" element={<DvfMap />} />
          <Route path="/map" element={<ScoreMap />} />
          <Route path="/classement" element={<Undervalued />} />
          <Route path="/commune/:code" element={<Commune />} />
          <Route path="/comparer" element={<Comparer />} />
          <Route path="/explorer" element={<Explorer />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
