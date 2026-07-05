import { BrowserRouter, Route, Routes } from "react-router-dom"

import Landing from "@/pages/landing"
import DvfMap from "@/pages/dvf-map"
import ScoreMap from "@/pages/score-map"
import Undervalued from "@/pages/undervalued"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/carte" element={<DvfMap />} />
        <Route path="/map" element={<ScoreMap />} />
        <Route path="/classement" element={<Undervalued />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
