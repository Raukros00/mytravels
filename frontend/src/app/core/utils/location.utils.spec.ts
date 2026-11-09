import { ARRIVAL_RADIUS_M, ArrivalStop, DevicePosition, arrivalAt, distanceTo, isFresh } from './location.utils';

/** Duomo di Torino e Mole Antonelliana (circa 780 m tra loro). */
const DUOMO = { lat: 45.07315, lng: 7.68524 };
const MOLE = { lat: 45.06904, lng: 7.69330 };

function pos(lat: number, lng: number, accuracy = 20, at = 1_000_000): DevicePosition {
  return { lat, lng, accuracy, at };
}

/** Punto a `meters` metri a nord di `p`. */
function north(p: { lat: number; lng: number }, meters: number) {
  return { lat: p.lat + meters / 111_320, lng: p.lng };
}

function stop(id: string, coordinates: { lat: number; lng: number } | null, extra: Partial<ArrivalStop> = {}): ArrivalStop {
  return { id, name: id, coordinates, done: false, skipped: false, ...extra };
}

describe('location.utils', () => {
  it('distanceTo: metri dalla tappa, null senza coordinate', () => {
    const near = north(DUOMO, 50);
    expect(distanceTo(near, DUOMO)!).toBeCloseTo(50, -1);
    expect(distanceTo(DUOMO, MOLE)!).toBeGreaterThan(700);
    expect(distanceTo(DUOMO, MOLE)!).toBeLessThan(1000);
    expect(distanceTo(DUOMO, null)).toBeNull();
    expect(distanceTo(DUOMO, { lat: undefined, lng: 7 })).toBeNull();
  });

  it('isFresh: posizione recente', () => {
    expect(isFresh(pos(0, 0, 10, 1000), 1000 + 60_000)).toBeTrue();
    expect(isFresh(pos(0, 0, 10, 1000), 1000 + 5 * 60_000)).toBeFalse();
    expect(isFresh(null, 0)).toBeFalse();
  });

  describe('arrivalAt', () => {
    const stops = () => [stop('duomo', DUOMO), stop('mole', MOLE), stop('senza', null)];

    it('entro 100 m dalla tappa', () => {
      const here = north(DUOMO, 60);
      expect(arrivalAt(pos(here.lat, here.lng), stops())?.id).toBe('duomo');
    });

    it('oltre 100 m: nessun arrivo', () => {
      const here = north(DUOMO, ARRIVAL_RADIUS_M + 30);
      expect(arrivalAt(pos(here.lat, here.lng), stops())).toBeNull();
    });

    it('posizione troppo imprecisa: nessun arrivo', () => {
      expect(arrivalAt(pos(DUOMO.lat, DUOMO.lng, 500), stops())).toBeNull();
    });

    it('tappe fatte, saltate o scartate con "No" non contano', () => {
      const here = pos(DUOMO.lat, DUOMO.lng);
      expect(arrivalAt(here, [stop('duomo', DUOMO, { done: true })])).toBeNull();
      expect(arrivalAt(here, [stop('duomo', DUOMO, { skipped: true })])).toBeNull();
      expect(arrivalAt(here, stops(), new Set(['duomo']))).toBeNull();
    });

    it('più tappe vicine: prima quella preferita, poi la più vicina', () => {
      const a = stop('a', north(DUOMO, 10));
      const b = stop('b', north(DUOMO, 70));
      const here = pos(DUOMO.lat, DUOMO.lng);
      expect(arrivalAt(here, [b, a])?.id).toBe('a');
      expect(arrivalAt(here, [a, b], new Set(), 'b')?.id).toBe('b');
    });
  });
});
