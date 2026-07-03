// @deck.gl/mapbox (v8) ne déclare pas son champ `types` dans package.json alors
// que les déclarations existent sous `typed/`. On les réexpose ici.
declare module "@deck.gl/mapbox" {
  export * from "@deck.gl/mapbox/typed"
}
