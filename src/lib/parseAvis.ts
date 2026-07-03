export interface WordEntry {
  word: string;
  count: number;
  size: number;
}

export interface CityWordCloud {
  slug: string;
  nom_ville: string;
  lat: number;
  lng: number;
  words: WordEntry[];
}

const CITY_COORDS: Record<string, [number, number]> = {
  "paris-1er-arrondissement":    [48.8606, 2.3477],
  "marseille-1er-arrondissement":[43.2965, 5.3698],
  "lyon-1er-arrondissement":     [45.7676, 4.8344],
  toulouse:                      [43.6047, 1.4442],
  nice:                          [43.7102, 7.2620],
  nantes:                        [47.2184, -1.5536],
  montpellier:                   [43.6110, 3.8767],
  strasbourg:                    [48.5734, 7.7521],
  bordeaux:                      [44.8378, -0.5792],
  lille:                         [50.6292, 3.0573],
  rennes:                        [48.1173, -1.6778],
  reims:                         [49.2583, 4.0317],
  "le-havre":                    [49.4938, 0.1077],
  "saint-etienne":               [45.4397, 4.3872],
  toulon:                        [43.1242, 5.9280],
  grenoble:                      [45.1885, 5.7245],
  dijon:                         [47.3220, 5.0415],
  angers:                        [47.4784, -0.5632],
  nimes:                         [43.8367, 4.3601],
  villeurbanne:                  [45.7676, 4.8795],
  "le-mans":                     [48.0061, 0.1996],
  "aix-en-provence":             [43.5297, 5.4474],
  "clermont-ferrand":            [45.7797, 3.0863],
  brest:                         [48.3904, -4.4861],
  tours:                         [47.3941, 0.6848],
  limoges:                       [45.8336, 1.2611],
  amiens:                        [49.8941, 2.2958],
  perpignan:                     [42.6887, 2.8948],
  metz:                          [49.1193, 6.1757],
  besancon:                      [47.2378, 6.0241],
  "boulogne-billancourt":        [48.8352, 2.2400],
  orleans:                       [47.9029, 1.9039],
  "saint-denis":                 [48.9362, 2.3574],
  argenteuil:                    [48.9472, 2.2467],
  rouen:                         [49.4432, 1.0993],
  montreuil:                     [48.8638, 2.4483],
  mulhouse:                      [47.7508, 7.3359],
  caen:                          [49.1829, -0.3707],
  nancy:                         [48.6921, 6.1844],
  "saint-paul":                  [-21.0000, 55.2833],
  tourcoing:                     [50.7239, 3.1612],
  roubaix:                       [50.6942, 3.1746],
  nanterre:                      [48.8924, 2.2070],
  "vitry-sur-seine":             [48.7872, 2.3928],
  creteil:                       [48.7773, 2.4556],
  avignon:                       [43.9493, 4.8055],
  poitiers:                      [46.5802, 0.3404],
  aubervilliers:                 [48.9137, 2.3827],
  dunkerque:                     [51.0343, 2.3775],
  "aulnay-sous-bois":            [48.9386, 2.4958],
  "asnieres-sur-seine":          [48.9153, 2.2854],
  colombes:                      [48.9228, 2.2534],
  versailles:                    [48.8014, 2.1301],
  "saint-pierre":                [-21.3393, 55.4781],
  courbevoie:                    [48.8972, 2.2528],
  "fort-de-france":              [14.6037, -61.0735],
  "le-tampon":                   [-21.2703, 55.5155],
  "rueil-malmaison":             [48.8763, 2.1833],
  pau:                           [43.2951, -0.3708],
  "champigny-sur-marne":         [48.8172, 2.5156],
  "la-rochelle":                 [46.1591, -1.1520],
  merignac:                      [44.8378, -0.6436],
  antibes:                       [43.5804, 7.1283],
  "saint-maur-des-fosses":       [48.7982, 2.4997],
  beziers:                       [43.3441, 3.2163],
  cannes:                        [43.5528, 7.0174],
  "brive-la-gaillarde":          [45.1583, 1.5337],
  calais:                        [50.9513, 1.8587],
  drancy:                        [48.9289, 2.4567],
  colmar:                        [48.0793, 7.3585],
  ajaccio:                       [41.9192, 8.7386],
  bourges:                       [47.0810, 2.3988],
  "issy-les-moulineaux":         [48.8233, 2.2753],
  "levallois-perret":            [48.8951, 2.2874],
  "la-seyne-sur-mer":            [43.1011, 5.8796],
  quimper:                       [47.9973, -4.0975],
  "noisy-le-grand":              [48.8477, 2.5531],
  "villeneuve-d-ascq":           [50.6190, 3.1430],
  troyes:                        [48.2973, 4.0744],
};

interface RawWordCloud {
  [slug: string]: {
    nom_ville: string;
    words: WordEntry[];
  };
}

export async function loadWordCloud(): Promise<CityWordCloud[]> {
  const resp = await fetch("/data/wordcloud.json");
  const raw: RawWordCloud = await resp.json();

  return Object.entries(raw)
    .map(([slug, data]) => {
      const coords = CITY_COORDS[slug];
      if (!coords) return null;
      return {
        slug,
        nom_ville: data.nom_ville,
        lat: coords[0],
        lng: coords[1],
        words: data.words,
      };
    })
    .filter((c): c is CityWordCloud => c !== null);
}
