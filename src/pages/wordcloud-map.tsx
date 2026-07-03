import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { loadWordCloud, type CityWordCloud } from "@/lib/parseAvis"
import WordCloudPopup from "@/components/WordCloudPopup"

export default function WordCloudMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<CityWordCloud | null>(null)
  const [cities, setCities] = useState<CityWordCloud[]>([])

  useEffect(() => {
    loadWordCloud().then(setCities)
  }, [])

  useEffect(() => {
    if (!mapRef.current || cities.length === 0) return

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [2.5, 46.5],
      zoom: 5.5,
    })

    map.on("load", () => {
      map.addSource("cities", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: cities.map((c) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [c.lng, c.lat] },
            properties: { slug: c.slug, nom_ville: c.nom_ville },
          })),
        },
      })

      map.addLayer({
        id: "cities-circle",
        type: "circle",
        source: "cities",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 6, 10, 14],
          "circle-color": "#6366f1",
          "circle-opacity": 0.85,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#fff",
        },
      })

      map.addLayer({
        id: "cities-label",
        type: "symbol",
        source: "cities",
        minzoom: 7,
        layout: {
          "text-field": ["get", "nom_ville"],
          "text-size": 12,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
        },
        paint: { "text-color": "#333", "text-halo-color": "#fff", "text-halo-width": 1 },
      })

      map.on("mouseenter", "cities-circle", () => {
        map.getCanvas().style.cursor = "pointer"
      })
      map.on("mouseleave", "cities-circle", () => {
        map.getCanvas().style.cursor = ""
      })

      map.on("click", "cities-circle", (e) => {
        const slug = e.features?.[0]?.properties?.slug as string
        const city = cities.find((c) => c.slug === slug) ?? null
        setSelected(city)
      })
    })

    return () => map.remove()
  }, [cities])

  return (
    <div className="relative h-svh w-svw overflow-hidden bg-background text-foreground">
      <div ref={mapRef} className="h-full w-full" />

      <div className="absolute top-4 left-4 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Retour à l'accueil">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <span className="font-display text-lg font-bold tracking-tight">
            Homepedia<span className="text-accent">.</span>
          </span>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          {cities.length > 0
            ? `${cities.length} villes · cliquer pour le nuage de mots`
            : "Chargement…"}
        </div>
      </div>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-[999] bg-black/45"
        />
      )}

      {selected && (
        <WordCloudPopup city={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
