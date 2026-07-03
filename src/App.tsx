import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { loadWordCloud, type CityWordCloud } from "@/lib/parseAvis";
import WordCloudPopup from "@/components/WordCloudPopup";

export default function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<CityWordCloud | null>(null);
  const [cities, setCities] = useState<CityWordCloud[]>([]);

  useEffect(() => {
    loadWordCloud().then(setCities);
  }, []);

  useEffect(() => {
    if (!mapRef.current || cities.length === 0) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [2.5, 46.5],
      zoom: 5.5,
    });

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
      });

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
      });

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
      });

      map.on("mouseenter", "cities-circle", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "cities-circle", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "cities-circle", (e) => {
        const slug = e.features?.[0]?.properties?.slug as string;
        const city = cities.find((c) => c.slug === slug) ?? null;
        setSelected(city);
      });
    });

    return () => map.remove();
  }, [cities]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          background: "rgba(255,255,255,0.93)",
          borderRadius: 10,
          padding: "12px 16px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          fontSize: 13,
          color: "#333",
          pointerEvents: "none",
        }}
      >
        <strong style={{ fontSize: 15 }}>Homepedia</strong>
        <br />
        <span style={{ color: "#666" }}>
          {cities.length > 0
            ? `${cities.length} villes · cliquer pour le nuage de mots`
            : "Chargement…"}
        </span>
      </div>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999 }}
        />
      )}

      {selected && (
        <WordCloudPopup city={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
