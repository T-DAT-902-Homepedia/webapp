import { BrowserRouter, Route, Routes } from "react-router-dom"

import Landing from "@/pages/landing"
import DvfMap from "@/pages/dvf-map"
import CivicMap from "@/pages/civic-map"
import TransportMap from "@/pages/transport-map"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/carte" element={<DvfMap />} />
        <Route path="/civic" element={<CivicMap />} />
        <Route path="/transport" element={<TransportMap />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
