import { Coordinates, LorenzRating } from '@/types';

// Bortle scale descriptions
const BORTLE_DESCRIPTIONS: Record<number, string> = {
  1: 'Truly dark sky — zodiacal light, gegenschein visible',
  2: 'Truly dark sky — some light pollution on horizon',
  3: 'Rural sky',
  4: 'Rural/suburban transition',
  5: 'Suburban sky',
  6: 'Bright suburban sky',
  7: 'Suburban/urban transition',
  8: 'City sky',
  9: 'Inner-city sky',
};

// Approximate Bortle → SQM mapping (mag/arcsec²)
const BORTLE_TO_SQM: Record<number, number> = {
  1: 21.9, 2: 21.5, 3: 21.3, 4: 20.8,
  5: 20.0, 6: 19.1, 7: 18.0, 8: 17.0, 9: 16.0,
};

/**
 * Returns a light-pollution rating for the given coordinates by sampling the
 * David Lorenz 2024 Light Pollution Atlas (data/maps/NorthAmerica2024.png).
 *
 * The atlas uses a fixed color scale mapped to Bortle classes. Pixel sampling
 * logic should be implemented here once the atlas file is available.
 * Atlas source: https://www.lightpollutionmap.info/ — credit David Lorenz.
 */
export async function getLorenzRating(coords: Coordinates): Promise<LorenzRating> {
  // TODO: sample pixel from Lorenz atlas PNG at coords and derive Bortle class
  const bortle = 4; // stub — replace with real pixel lookup
  const sqm = BORTLE_TO_SQM[bortle] ?? 20.0;

  return {
    bortle,
    sqm,
    description: BORTLE_DESCRIPTIONS[bortle] ?? 'Unknown',
  };
}
