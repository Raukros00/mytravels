import { formatDistance, hasCoords, haversineMeters } from './geo.utils';

describe('geo.utils', () => {
  it('hasCoords: solo numeri validi', () => {
    expect(hasCoords({ lat: 41.4, lng: 2.17 })).toBeTrue();
    expect(hasCoords({ lat: 0, lng: 0 })).toBeTrue();
    expect(hasCoords({ lat: 91, lng: 0 })).toBeFalse();
    expect(hasCoords({ lat: 41 })).toBeFalse();
    expect(hasCoords(null)).toBeFalse();
  });

  it('haversineMeters: distanze note in linea d\'aria', () => {
    // Colosseo → Pantheon ≈ 1,6 km.
    const d = haversineMeters({ lat: 41.8902, lng: 12.4922 }, { lat: 41.8986, lng: 12.4769 });
    expect(d).toBeGreaterThan(1500);
    expect(d).toBeLessThan(1700);
    expect(haversineMeters({ lat: 45, lng: 9 }, { lat: 45, lng: 9 })).toBe(0);
    // Un grado di latitudine ≈ 111 km.
    expect(Math.round(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) / 1000)).toBe(111);
  });

  it('formatDistance: metri, chilometri con la virgola in italiano', () => {
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(1234, 'en')).toBe('1.2 km');
    expect(formatDistance(12_400)).toBe('12 km');
  });
});
