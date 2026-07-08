import { MapboxOverlay } from "@deck.gl/mapbox"
import type { Layer } from "deck.gl"
import { useControl } from "react-map-gl/maplibre"
import type { IControl } from "maplibre-gl"

/** Overlay deck.gl monté comme contrôle maplibre. En `interleaved`, les couches
 *  s'insèrent DANS la pile maplibre (via leur prop `beforeId`), donc sous les
 *  labels du fond de carte qui restent lisibles ; sinon deck dessine sur son
 *  propre canvas au-dessus de la carte entière.
 *  `interleaved` est figé à la construction du contrôle : pour en changer,
 *  remonter le composant (prop React `key`). */
export function DeckOverlay({
  layers,
  interleaved = true,
}: {
  layers: Layer[]
  interleaved?: boolean
}) {
  const overlay = useControl(
    () => new MapboxOverlay({ interleaved, layers }) as unknown as IControl,
  )
  ;(overlay as unknown as MapboxOverlay).setProps({ layers })
  return null
}
