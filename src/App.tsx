import React from 'react';
import DeckGL from '@deck.gl/react';
import type { MapViewState } from '@deck.gl/core';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 2.3488,
  latitude: 48.8534,
  zoom: 13
};

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <DeckGL initialViewState={INITIAL_VIEW_STATE} controller style={{ width: '100%', height: '100%' }} >
        <Map mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" />
      </DeckGL>
    </div>
  );
}
