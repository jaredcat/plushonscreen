// The cast of characters. Each sighting references a plush by `id`.
// Adding a new plush = add an entry here, then sightings can use its id.
export interface Plush {
  id: string;
  name: string; // display name
  fullName: string; // IKEA's full product name
  emoji: string;
  color: string; // accent color (CSS) used in cards/badges for this plush
  blurb: string;
}

export const plushes: Plush[] = [
  {
    id: 'djungelorm',
    name: 'Djungelorm',
    fullName: 'IKEA DJUNGELSKOG Snake',
    emoji: '🐍',
    color: '#3f9b46',
    blurb:
      "IKEA's beloved green snake plush. Nearly five feet of cuddly serpent that keeps slithering its way onto the big screen.",
  },
  {
    id: 'blahaj',
    name: 'Blåhaj',
    fullName: 'IKEA Blåhaj Shark',
    emoji: '🦈',
    color: '#6CA7B5',
    blurb:
      "IKEA's beloved blue shark plush. Big and safe to have by your side if you want to discover the world below the surface of the ocean. The blue shark can swim very far, dive really deep and hear noises from almost 250 meters away.",
  },
];

export const plushById = (id: string): Plush | undefined =>
  plushes.find((p) => p.id === id);
